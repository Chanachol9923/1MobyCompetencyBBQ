"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getGapRows } from "@/server/competency";
import {
  NOTE_SEP,
  goalColumns,
  goalFieldsSchema,
  goalShapeError,
} from "@/server/goal-input";
import {
  assertEmployee,
  assertPermission,
  recordActivity,
} from "@/server/session";

/**
 * "แนบหลักฐานการเรียนรู้" — the evidence an employee hangs on a goal of their
 * own plan, and (further down) the activities they add to it themselves.
 *
 * Both start from `assertEmployee()` and check the row against that id. The
 * browser sends a goal id and an evidence id, never an employee id, and neither
 * is trusted: a goal that belongs to somebody else resolves to `not_found`
 * rather than to a permission error, because the viewer should not learn that
 * it exists.
 *
 * Errors come back as *codes*, not sentences — the server has no language, the
 * client renders each one through `tt()`.
 */

export type EvidenceError =
  | "not_authorised"
  | "invalid"
  | "not_found"
  | "bad_url"
  | "short_note"
  | "no_certificate"
  | "already_attached";

export type EvidenceResult =
  | { ok: true }
  | { ok: false; error: EvidenceError };

const fail = (error: EvidenceError): EvidenceResult => ({ ok: false, error });

/** A note has to say something; four characters is the floor. */
const MIN_NOTE = 4;

const attachSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CERTIFICATE"),
    goalId: z.string().trim().min(1).max(200),
    certificateId: z.string().trim().min(1).max(200),
  }),
  z.object({
    kind: z.literal("LINK"),
    goalId: z.string().trim().min(1).max(200),
    url: z.string().trim().min(1).max(2000),
    label: z.string().trim().max(200).default(""),
  }),
  z.object({
    kind: z.literal("NOTE"),
    goalId: z.string().trim().min(1).max(200),
    note: z.string().trim().max(4000),
  }),
]);

export type AttachEvidenceInput = z.infer<typeof attachSchema>;

/** http(s) only — a `javascript:` or `data:` reference is not a link to work. */
function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

function revalidatePlan() {
  revalidatePath("/idp");
  revalidatePath("/team-profile");
}

export async function attachEvidenceAction(
  input: AttachEvidenceInput,
): Promise<EvidenceResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }
  const employeeId = viewer.employeeId;

  // the goal id came from the browser: it only resolves inside this person's
  // own plan
  const goal = await db.idpGoal.findFirst({
    where: { id: data.goalId, employeeId },
    select: {
      id: true,
      competency: { select: { nameEn: true } },
    },
  });
  if (!goal) return fail("not_found");

  let label: string;
  let reference: string;

  if (data.kind === "CERTIFICATE") {
    const certificate = await db.certificate.findFirst({
      where: { id: data.certificateId, employeeId },
      select: { id: true, titleEn: true },
    });
    if (!certificate) return fail("no_certificate");
    label = certificate.titleEn;
    reference = certificate.id;
  } else if (data.kind === "LINK") {
    const url = httpUrl(data.url);
    if (!url) return fail("bad_url");
    reference = url.toString();
    label = data.label || url.hostname;
  } else {
    const body = data.note;
    if (body.length < MIN_NOTE) return fail("short_note");
    reference = body;
    label = truncate(body, 60);
  }

  // the same certificate or the same link twice on one goal is a mistake, not
  // a second piece of evidence
  if (data.kind !== "NOTE") {
    const clash = await db.goalEvidence.findFirst({
      where: { goalId: goal.id, kind: data.kind, reference },
      select: { id: true },
    });
    if (clash) return fail("already_attached");
  }

  await db.goalEvidence.create({
    data: { goalId: goal.id, kind: data.kind, label, reference },
  });

  await recordActivity({
    viewer,
    action: "Attached learning evidence",
    targetType: "IdpGoal",
    targetId: goal.id,
    targetLabel: goal.competency.nameEn,
    detail: `${data.kind} · ${label}`,
  });

  revalidatePlan();
  return { ok: true };
}

const removeSchema = z.object({
  evidenceId: z.string().trim().min(1).max(200),
});

export async function removeEvidenceAction(
  input: z.infer<typeof removeSchema>,
): Promise<EvidenceResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }

  // scoped through the goal, so an id belonging to somebody else finds nothing
  const item = await db.goalEvidence.findFirst({
    where: { id: parsed.data.evidenceId, goal: { employeeId: viewer.employeeId } },
    select: {
      id: true,
      kind: true,
      label: true,
      goalId: true,
      goal: { select: { competency: { select: { nameEn: true } } } },
    },
  });
  if (!item) return fail("not_found");

  // only the link between the goal and the proof goes; the certificate itself
  // is a record of something that really happened and is never deleted here
  await db.goalEvidence.delete({ where: { id: item.id } });

  await recordActivity({
    viewer,
    action: "Removed learning evidence",
    targetType: "IdpGoal",
    targetId: item.goalId,
    targetLabel: item.goal.competency.nameEn,
    detail: `${item.kind} · ${item.label}`,
  });

  revalidatePlan();
  return { ok: true };
}

/* ======================================================= the owner's goals */

/**
 * "เพิ่ม/แก้ไข/ลบกิจกรรม" on your own plan (brief scope item 3).
 *
 * The owner may add development activities to their own plan, and edit or
 * delete *only the ones they added*. A goal their manager set stays the
 * manager's: it resolves to `not_yours`, and the manager keeps every right
 * they had in Team Profile, including over the goals added here.
 *
 * Nothing about the subject comes from the browser — the employee id is the
 * session's, and an edited goal is read back and checked against it and
 * against its author (`IdpGoal.createdById`).
 */

export type OwnGoalError =
  | "not_authorised"
  | "invalid"
  | "unknown_competency"
  | "unknown_course"
  | "course_in_plan"
  | "bad_dates"
  | "bad_levels"
  | "not_found"
  | "not_yours";

export type OwnGoalResult = { ok: true } | { ok: false; error: OwnGoalError };

const ownGoalSchema = goalFieldsSchema.extend({
  /** null creates, a string edits that row */
  goalId: z.string().trim().min(1).max(200).nullable(),
});

/** The owner, from the session, with the permission to work their own plan. */
async function assertPlanOwner() {
  const viewer = await assertPermission(PERMISSIONS.WORK_OWN_IDP);
  if (!viewer.employeeId) throw new Error("no employee record");
  return viewer as typeof viewer & { employeeId: string };
}

/** Tell the owner's manager, who keeps oversight of the whole plan. */
async function notifyManager(
  employeeId: string,
  text: { titleEn: string; titleTh: string; bodyEn: string; bodyTh: string },
) {
  const owner = await db.employee.findUnique({
    where: { id: employeeId },
    select: { manager: { select: { id: true, active: true } } },
  });
  if (!owner?.manager?.active) return;
  await db.notification.create({
    data: {
      employeeId: owner.manager.id,
      kind: "IDP",
      channel: "IN_APP",
      ...text,
      href: "/team-profile",
    },
  });
}

export async function saveOwnGoalAction(
  input: z.input<typeof ownGoalSchema>,
): Promise<OwnGoalResult> {
  const parsed = ownGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  const shape = goalShapeError(data);
  if (shape) return { ok: false, error: shape };

  let viewer;
  try {
    viewer = await assertPlanOwner();
  } catch {
    return { ok: false, error: "not_authorised" };
  }
  const employeeId = viewer.employeeId;

  if (data.goalId) {
    const existing = await db.idpGoal.findUnique({
      where: { id: data.goalId },
      select: { employeeId: true, createdById: true },
    });
    // somebody else's goal does not exist, as far as this viewer is told
    if (!existing || existing.employeeId !== employeeId) {
      return { ok: false, error: "not_found" };
    }
    if (existing.createdById !== employeeId) return { ok: false, error: "not_yours" };
  }

  // brief §1.3: an activity always closes a gap — only a competency this
  // person's career role is assessed on
  const rows = await getGapRows(employeeId);
  if (!rows.some((r) => r.competencyId === data.competencyId)) {
    return { ok: false, error: "unknown_competency" };
  }

  if (data.courseId) {
    const course = await db.course.findUnique({
      where: { id: data.courseId },
      select: { status: true },
    });
    if (!course || course.status !== "PUBLISHED") {
      return { ok: false, error: "unknown_course" };
    }
    // one goal per course: finishing a course closes every goal on it, and
    // each closed goal earns points, so a second goal on it would pay twice
    const twin = await db.idpGoal.findFirst({
      where: {
        employeeId,
        courseId: data.courseId,
        ...(data.goalId ? { id: { not: data.goalId } } : {}),
      },
      select: { id: true },
    });
    if (twin) return { ok: false, error: "course_in_plan" };
  }

  const competency = await db.competency.findUnique({
    where: { id: data.competencyId },
    select: { nameEn: true, nameTh: true },
  });
  if (!competency) return { ok: false, error: "unknown_competency" };

  const name = viewer.employeeName ?? viewer.name;
  const remark = data.note
    ? `Added by ${name}${NOTE_SEP}${data.note}`
    : `Added by ${name}`;
  const fields = goalColumns(data, remark);

  let goalId = data.goalId;
  if (goalId) {
    await db.idpGoal.update({ where: { id: goalId }, data: fields });
  } else {
    const created = await db.idpGoal.create({
      data: { ...fields, employeeId, createdById: employeeId },
      select: { id: true },
    });
    goalId = created.id;
  }

  const levels = `${data.fromLevel} → ${data.toLevel}`;
  await notifyManager(
    employeeId,
    data.goalId
      ? {
          titleEn: `${name} updated a development activity`,
          titleTh: `${name} แก้ไขกิจกรรมพัฒนาของตนเอง`,
          bodyEn: `${competency.nameEn}: level ${levels} by ${data.dueDate}.`,
          bodyTh: `${competency.nameTh ?? competency.nameEn}: ระดับ ${levels} ภายใน ${data.dueDate}`,
        }
      : {
          titleEn: `${name} added a development activity`,
          titleTh: `${name} เพิ่มกิจกรรมพัฒนาให้ตนเอง`,
          bodyEn: `${competency.nameEn}: level ${levels} by ${data.dueDate}.`,
          bodyTh: `${competency.nameTh ?? competency.nameEn}: ระดับ ${levels} ภายใน ${data.dueDate}`,
        },
  );

  await recordActivity({
    viewer,
    action: data.goalId ? "Edited own IDP goal" : "Added own IDP goal",
    targetType: "IdpGoal",
    targetId: goalId,
    targetLabel: `${name} · ${competency.nameEn}`,
    detail: `${levels} · ${data.activity} · ${data.startDate} → ${data.dueDate}`,
  });

  revalidatePlan();
  revalidatePath("/dashboard");
  return { ok: true };
}

const ownDeleteSchema = z.object({
  goalId: z.string().trim().min(1).max(200),
});

export async function deleteOwnGoalAction(
  input: z.input<typeof ownDeleteSchema>,
): Promise<OwnGoalResult> {
  const parsed = ownDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  let viewer;
  try {
    viewer = await assertPlanOwner();
  } catch {
    return { ok: false, error: "not_authorised" };
  }
  const employeeId = viewer.employeeId;

  const goal = await db.idpGoal.findUnique({
    where: { id: parsed.data.goalId },
    select: {
      id: true,
      employeeId: true,
      createdById: true,
      activity: true,
      competency: { select: { nameEn: true, nameTh: true } },
    },
  });
  if (!goal || goal.employeeId !== employeeId) return { ok: false, error: "not_found" };
  if (goal.createdById !== employeeId) return { ok: false, error: "not_yours" };

  await db.idpGoal.delete({ where: { id: goal.id } });

  const name = viewer.employeeName ?? viewer.name;
  await notifyManager(employeeId, {
    titleEn: `${name} removed a development activity`,
    titleTh: `${name} ลบกิจกรรมพัฒนาของตนเอง`,
    bodyEn: `${goal.competency.nameEn} is no longer part of ${name}'s development plan.`,
    bodyTh: `${goal.competency.nameTh ?? goal.competency.nameEn} ไม่อยู่ในแผนพัฒนาของ ${name} แล้ว`,
  });

  await recordActivity({
    viewer,
    action: "Removed own IDP goal",
    targetType: "IdpGoal",
    targetId: goal.id,
    targetLabel: `${name} · ${goal.competency.nameEn}`,
    detail: goal.activity,
  });

  revalidatePlan();
  revalidatePath("/dashboard");
  return { ok: true };
}
