"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getGapRows } from "@/server/competency";
import { assertManagerOf, recordActivity } from "@/server/session";

/**
 * Every write the Team Profile makes.
 *
 * The shape is the same each time: validate with zod, call `assertManagerOf`
 * before touching a row — middleware never decides this — write, record the
 * activity, then revalidate the screens that show the result. Expected
 * failures come back as a typed result so the form can render them in place;
 * only a genuine bug throws.
 *
 * Errors are returned as *codes*, not sentences, because the server has no
 * language: the client renders each one through `tt()`.
 */

export type ActionError =
  | "not_authorised"
  | "invalid"
  | "unknown_competency"
  | "unknown_course"
  | "bad_dates"
  | "not_found";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: ActionError };

const ACTIVITY = ["ONLINE_COURSE", "COACHING", "ON_THE_JOB"] as const;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

const goalSchema = z.object({
  /** null creates, a string edits that row */
  goalId: z.string().min(1).nullable(),
  employeeId: z.string().min(1),
  competencyId: z.string().min(1),
  courseId: z.string().min(1).nullable(),
  fromLevel: z.number().int().min(0).max(4),
  toLevel: z.number().int().min(1).max(4),
  activity: z.enum(ACTIVITY),
  startDate: z.string().regex(isoDay),
  dueDate: z.string().regex(isoDay),
  note: z.string().max(500),
});

export type GoalInput = z.infer<typeof goalSchema>;

/** Separator the form uses to split the stamp from the manager's own words. */
const NOTE_SEP = " — ";

/** Revalidate everywhere a goal is visible. */
function revalidateGoalViews() {
  revalidatePath("/team-profile");
  revalidatePath("/idp");
  revalidatePath("/dashboard");
}

export async function saveGoalAction(input: GoalInput): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  if (Date.parse(data.dueDate) <= Date.parse(data.startDate)) {
    return { ok: false, error: "bad_dates" };
  }

  let viewer;
  try {
    viewer = await assertManagerOf(data.employeeId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  // a goal may only target a competency this person's career role is assessed
  // on — the gap engine already dropped the rest
  const rows = await getGapRows(data.employeeId);
  const row = rows.find((r) => r.competencyId === data.competencyId);
  if (!row) return { ok: false, error: "unknown_competency" };

  if (data.courseId) {
    const course = await db.course.findUnique({
      where: { id: data.courseId },
      select: { id: true },
    });
    if (!course) return { ok: false, error: "unknown_course" };
  }

  const [employee, competency] = await Promise.all([
    db.employee.findUnique({
      where: { id: data.employeeId },
      select: { name: true },
    }),
    db.competency.findUnique({
      where: { id: data.competencyId },
      select: { nameEn: true, nameTh: true },
    }),
  ]);
  if (!employee || !competency) return { ok: false, error: "not_found" };

  const remark = data.note
    ? `Assigned by ${viewer.name}${NOTE_SEP}${data.note}`
    : `Assigned by ${viewer.name}`;

  const fields = {
    competencyId: data.competencyId,
    courseId: data.courseId,
    fromLevel: data.fromLevel,
    toLevel: data.toLevel,
    activity: data.activity,
    startDate: new Date(`${data.startDate}T00:00:00.000Z`),
    dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
    remark,
  };

  const detail =
    `${data.fromLevel} → ${data.toLevel} · ${data.activity} · ` +
    `${data.startDate} → ${data.dueDate}`;

  if (data.goalId) {
    const existing = await db.idpGoal.findUnique({
      where: { id: data.goalId },
      select: { id: true, employeeId: true },
    });
    // never trust the id the browser sent — it has to belong to this report
    if (!existing || existing.employeeId !== data.employeeId) {
      return { ok: false, error: "not_found" };
    }
    await db.idpGoal.update({ where: { id: existing.id }, data: fields });
  } else {
    await db.idpGoal.create({
      data: {
        ...fields,
        employeeId: data.employeeId,
        createdById: viewer.employeeId,
      },
    });
  }

  await db.notification.create({
    data: {
      employeeId: data.employeeId,
      kind: "IDP",
      channel: "BOTH",
      titleEn: data.goalId
        ? "Your manager updated a development goal"
        : "Your manager added a development goal",
      titleTh: data.goalId
        ? "หัวหน้าปรับแก้เป้าหมายพัฒนาของคุณ"
        : "หัวหน้าเพิ่มเป้าหมายพัฒนาให้คุณ",
      bodyEn: `${competency.nameEn}: level ${data.fromLevel} → ${data.toLevel} by ${data.dueDate}.`,
      bodyTh: `${competency.nameTh ?? competency.nameEn}: ระดับ ${data.fromLevel} → ${data.toLevel} ภายใน ${data.dueDate}`,
      href: "/idp",
    },
  });

  await recordActivity({
    viewer,
    action: data.goalId ? "Edited IDP goal" : "Assigned IDP goal",
    targetType: "IdpGoal",
    targetId: data.goalId ?? undefined,
    targetLabel: `${employee.name} · ${competency.nameEn}`,
    detail,
  });

  revalidateGoalViews();
  return { ok: true };
}

const deleteSchema = z.object({
  goalId: z.string().min(1),
  employeeId: z.string().min(1),
});

export async function deleteGoalAction(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { goalId, employeeId } = parsed.data;

  let viewer;
  try {
    viewer = await assertManagerOf(employeeId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const goal = await db.idpGoal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      employeeId: true,
      activity: true,
      competency: { select: { nameEn: true, nameTh: true } },
      employee: { select: { name: true } },
    },
  });
  if (!goal || goal.employeeId !== employeeId) {
    return { ok: false, error: "not_found" };
  }

  await db.idpGoal.delete({ where: { id: goal.id } });

  await db.notification.create({
    data: {
      employeeId,
      kind: "IDP",
      channel: "BOTH",
      titleEn: "Your manager removed a development goal",
      titleTh: "หัวหน้านำเป้าหมายพัฒนาออกจากแผนของคุณ",
      bodyEn: `${goal.competency.nameEn} is no longer part of your development plan.`,
      bodyTh: `${goal.competency.nameTh ?? goal.competency.nameEn} ไม่อยู่ในแผนพัฒนาของคุณแล้ว`,
      href: "/idp",
    },
  });

  await recordActivity({
    viewer,
    action: "Removed IDP goal",
    targetType: "IdpGoal",
    targetId: goal.id,
    targetLabel: `${goal.employee.name} · ${goal.competency.nameEn}`,
    detail: goal.activity,
  });

  revalidateGoalViews();
  return { ok: true };
}

const noteSchema = z.object({
  employeeId: z.string().min(1),
  body: z.string().max(4000),
});

/**
 * The coaching note is unique per subject and author, so an upsert is the whole
 * operation: one manager's note about one person, replaced in place.
 */
export async function saveCoachingNoteAction(
  input: z.infer<typeof noteSchema>,
): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { employeeId, body } = parsed.data;

  let viewer;
  try {
    viewer = await assertManagerOf(employeeId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }
  if (!viewer.employeeId) return { ok: false, error: "not_authorised" };

  const trimmed = body.trim();
  if (trimmed) {
    await db.coachingNote.upsert({
      where: {
        subjectId_authorId: {
          subjectId: employeeId,
          authorId: viewer.employeeId,
        },
      },
      update: { body: trimmed },
      create: {
        subjectId: employeeId,
        authorId: viewer.employeeId,
        body: trimmed,
      },
    });
  } else {
    await db.coachingNote.deleteMany({
      where: { subjectId: employeeId, authorId: viewer.employeeId },
    });
  }

  await recordActivity({
    viewer,
    action: trimmed ? "Saved coaching note" : "Cleared coaching note",
    targetType: "CoachingNote",
    targetId: employeeId,
  });

  revalidatePath("/team-profile");
  return { ok: true };
}
