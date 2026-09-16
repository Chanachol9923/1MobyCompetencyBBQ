"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getActiveCycle } from "@/server/competency";
import {
  dbMode,
  getCompetencyQuestions,
  getKpiItems,
  type Mode,
} from "@/server/assessment";
import {
  NotAuthorised,
  assertManagerOf,
  assertPermission,
  recordActivity,
  type Viewer,
} from "@/server/session";

/**
 * Every write the 180° assessment makes.
 *
 * The shape is the same each time: validate with zod, resolve who is asking
 * from the session and prove they may touch *this* assessment, write, record
 * the activity, then revalidate. The id in the URL is never trusted — `guard()`
 * below re-derives the ownership rule from the session on every single call,
 * because a server action is a public endpoint and middleware decides nothing.
 *
 * Answers are saved as they are made rather than batched at the end, so a
 * half-finished assessment survives a refresh, a closed laptop or a crash.
 *
 * Errors come back as *codes*, not sentences: the server has no language, and
 * the client renders each one through `tt()`.
 */

export type ActionError =
  | "not_authorised"
  | "invalid"
  | "no_cycle"
  | "cycle_closed"
  | "not_found"
  | "not_assessed"
  | "already_submitted"
  | "not_submitted"
  | "incomplete"
  | "bad_weights";

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: ActionError };

const MODE = ["self", "supervisor"] as const;
const SCORE = z.number().int().min(1).max(4);

/* ------------------------------------------------------------------ guard */

type Guarded = {
  viewer: Viewer & { employeeId: string };
  /** who owns the answers — the subject for self, the manager for supervisor */
  reviewerId: string;
  subjectId: string;
};

/**
 * The permission and the ownership check, together, for one mode.
 *
 * `RUN_SELF_ASSESSMENT` alone would let anyone with the permission rate anyone
 * else, and `REVIEW_DIRECT_REPORTS` alone would let a manager rate somebody
 * else's team — so both are paired with a row-level check.
 */
async function guard(mode: Mode, targetId: string): Promise<Guarded> {
  if (mode === "self") {
    const viewer = await assertPermission(PERMISSIONS.RUN_SELF_ASSESSMENT);
    if (!viewer.employeeId || viewer.employeeId !== targetId) {
      throw new NotAuthorised("A self assessment can only be your own.");
    }
    return {
      viewer: viewer as Viewer & { employeeId: string },
      reviewerId: viewer.employeeId,
      subjectId: viewer.employeeId,
    };
  }

  const viewer = await assertPermission(PERMISSIONS.REVIEW_DIRECT_REPORTS);
  await assertManagerOf(targetId);
  if (!viewer.employeeId) {
    throw new NotAuthorised("Your account is not linked to an employee record yet.");
  }
  return {
    viewer: viewer as Viewer & { employeeId: string },
    reviewerId: viewer.employeeId,
    subjectId: targetId,
  };
}

/** The open cycle, refusing the write when there is nothing to write into. */
async function openCycle() {
  const cycle = await getActiveCycle();
  if (!cycle) return { error: "no_cycle" as const };
  if (cycle.status === "CLOSED" || cycle.status === "DRAFT") {
    return { error: "cycle_closed" as const };
  }
  return { cycle };
}

function revalidateAssessmentViews(mode: Mode, targetId: string) {
  revalidatePath("/assessment");
  revalidatePath(`/assessment/${mode}/${targetId}`);
}

/** Everywhere a submitted assessment changes what is on screen. */
function revalidateResultViews(mode: Mode, targetId: string) {
  revalidateAssessmentViews(mode, targetId);
  revalidatePath("/dashboard");
  revalidatePath("/team-profile");
  revalidatePath("/reports");
  revalidatePath("/idp");
}

/* ------------------------------------------------------- save one rating */

const scoreSchema = z.object({
  mode: z.enum(MODE),
  targetId: z.string().min(1),
  competencyId: z.string().min(1),
  score: SCORE,
});

/**
 * One rating, upserted the moment it is made.
 *
 * The `Assessment` row is created lazily here rather than when the wizard
 * opens, so "not started" stays a real absence in the database and the hub can
 * tell the difference between nobody having opened a review and somebody having
 * opened one and rated nothing.
 */
export async function saveScoreAction(
  input: z.infer<typeof scoreSchema>,
): Promise<ActionResult> {
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { mode, targetId, competencyId, score } = parsed.data;

  let who: Guarded;
  try {
    who = await guard(mode, targetId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const open = await openCycle();
  if (!open.cycle) return { ok: false, error: open.error };
  const { cycle } = open;

  // rule 1: a competency this career role has no expected level for is not
  // assessed, and no amount of posting to this endpoint makes it so
  const questions = await getCompetencyQuestions(who.subjectId);
  if (!questions.some((q) => q.id === competencyId)) {
    return { ok: false, error: "not_assessed" };
  }

  const key = {
    cycleId: cycle.id,
    subjectId: who.subjectId,
    reviewerId: who.reviewerId,
    mode: dbMode(mode),
  };

  const existing = await db.assessment.findUnique({
    where: { cycleId_subjectId_reviewerId_mode: key },
    select: { id: true, submittedAt: true },
  });
  if (existing?.submittedAt) return { ok: false, error: "already_submitted" };

  const assessment =
    existing ??
    (await db.assessment.create({ data: key, select: { id: true, submittedAt: true } }));

  await db.assessmentScore.upsert({
    where: {
      assessmentId_competencyId: { assessmentId: assessment.id, competencyId },
    },
    update: { score },
    create: { assessmentId: assessment.id, competencyId, score },
  });

  // only the hub shows progress; the wizard already has the answer on screen,
  // so a rating does not need to re-render the page it was made on
  revalidatePath("/assessment");
  return { ok: true };
}

/* ---------------------------------------------------------- the KPI list */

const kpiItemSchema = z.object({
  /** null adds a row, a string edits that one */
  id: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(300),
  weight: z.number().int().min(1).max(100),
});

const kpiListSchema = z.object({
  mode: z.enum(MODE),
  targetId: z.string().min(1),
  items: z.array(kpiItemSchema).max(20),
});

export type KpiItemInput = z.infer<typeof kpiItemSchema>;

/**
 * Replace the KPI set for this person and cycle.
 *
 * The client requirement is that the weights total 100, and this is where that
 * is true — the browser shows the shortfall as you type, but the rule is
 * enforced on the server, where it cannot be skipped. An empty list is allowed
 * (a cycle may legitimately have no KPI yet); a non-empty one must add up.
 *
 * Rows are matched by id so scores already given survive an edit to the wording
 * or the weight; rows the client dropped are deleted with their scores.
 */
export async function saveKpiItemsAction(
  input: z.infer<typeof kpiListSchema>,
): Promise<ActionResult> {
  const parsed = kpiListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { mode, targetId, items } = parsed.data;

  let who: Guarded;
  try {
    who = await guard(mode, targetId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const open = await openCycle();
  if (!open.cycle) return { ok: false, error: open.error };
  const { cycle } = open;

  const total = items.reduce((a, i) => a + i.weight, 0);
  if (items.length > 0 && total !== 100) {
    return { ok: false, error: "bad_weights" };
  }

  const existing = await db.kpiItem.findMany({
    where: { cycleId: cycle.id, employeeId: who.subjectId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  // an id the browser invented, or one belonging to somebody else, is treated
  // as a new row rather than an update of a row it was never allowed to see
  const keep = items
    .map((i) => i.id)
    .filter((id): id is string => Boolean(id) && existingIds.has(id as string));
  const removed = existing.filter((e) => !keep.includes(e.id)).map((e) => e.id);

  await db.$transaction([
    ...(removed.length
      ? [db.kpiItem.deleteMany({ where: { id: { in: removed } } })]
      : []),
    ...items.map((item) =>
      item.id && existingIds.has(item.id)
        ? db.kpiItem.update({
            where: { id: item.id },
            data: { name: item.name, target: item.target, weight: item.weight },
          })
        : db.kpiItem.create({
            data: {
              cycleId: cycle.id,
              employeeId: who.subjectId,
              name: item.name,
              target: item.target,
              weight: item.weight,
            },
          }),
    ),
  ]);

  await recordActivity({
    viewer: who.viewer,
    action: "Updated KPI items",
    targetType: "KpiItem",
    targetId: who.subjectId,
    targetLabel: cycle.nameEn,
    detail: `${items.length} items · ${total}%`,
  });

  revalidateAssessmentViews(mode, targetId);
  return { ok: true };
}

/* ------------------------------------------------------- score one KPI */

const kpiScoreSchema = z.object({
  mode: z.enum(MODE),
  targetId: z.string().min(1),
  kpiItemId: z.string().min(1),
  score: SCORE,
});

/**
 * `KpiItem.score` is a single column, so it is the cycle's agreed KPI result
 * rather than a per-mode opinion: the employee proposes it in their self
 * assessment and the supervisor review — the official record — overwrites it.
 */
export async function saveKpiScoreAction(
  input: z.infer<typeof kpiScoreSchema>,
): Promise<ActionResult> {
  const parsed = kpiScoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { mode, targetId, kpiItemId, score } = parsed.data;

  let who: Guarded;
  try {
    who = await guard(mode, targetId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const open = await openCycle();
  if (!open.cycle) return { ok: false, error: open.error };
  const { cycle } = open;

  const item = await db.kpiItem.findUnique({
    where: { id: kpiItemId },
    select: { id: true, cycleId: true, employeeId: true },
  });
  // the KPI has to belong to this person, in this cycle
  if (!item || item.employeeId !== who.subjectId || item.cycleId !== cycle.id) {
    return { ok: false, error: "not_found" };
  }

  const assessment = await db.assessment.findUnique({
    where: {
      cycleId_subjectId_reviewerId_mode: {
        cycleId: cycle.id,
        subjectId: who.subjectId,
        reviewerId: who.reviewerId,
        mode: dbMode(mode),
      },
    },
    select: { submittedAt: true },
  });
  if (assessment?.submittedAt) return { ok: false, error: "already_submitted" };

  await db.kpiItem.update({ where: { id: item.id }, data: { score } });

  revalidatePath("/assessment");
  return { ok: true };
}

/* ----------------------------------------------------------------- submit */

const submitSchema = z.object({
  mode: z.enum(MODE),
  targetId: z.string().min(1),
});

/** +30 points for finishing a self assessment, once per assessment. */
const SELF_ASSESSMENT_POINTS = 30;
const SELF_ASSESSMENT_REASON = "Completed self assessment";

export async function submitAssessmentAction(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult<{ pointsAwarded: number }>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { mode, targetId } = parsed.data;

  let who: Guarded;
  try {
    who = await guard(mode, targetId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const open = await openCycle();
  if (!open.cycle) return { ok: false, error: open.error };
  const { cycle } = open;

  const [questions, kpis] = await Promise.all([
    getCompetencyQuestions(who.subjectId),
    getKpiItems(cycle.id, who.subjectId),
  ]);

  const assessment = await db.assessment.findUnique({
    where: {
      cycleId_subjectId_reviewerId_mode: {
        cycleId: cycle.id,
        subjectId: who.subjectId,
        reviewerId: who.reviewerId,
        mode: dbMode(mode),
      },
    },
    select: {
      id: true,
      submittedAt: true,
      scores: { select: { competencyId: true } },
    },
  });
  if (!assessment) return { ok: false, error: "incomplete" };
  if (assessment.submittedAt) return { ok: false, error: "already_submitted" };

  // completeness is checked here, not only in the browser: every competency the
  // role is assessed on, and every KPI that has been defined
  const rated = new Set(assessment.scores.map((s) => s.competencyId));
  const missing =
    questions.filter((q) => !rated.has(q.id)).length +
    kpis.filter((k) => k.score === null).length;
  if (missing > 0) return { ok: false, error: "incomplete" };

  const submittedAt = new Date();
  await db.assessment.update({
    where: { id: assessment.id },
    data: { submittedAt },
  });

  const subject = await db.employee.findUnique({
    where: { id: who.subjectId },
    select: { name: true },
  });

  let pointsAwarded = 0;

  if (mode === "self") {
    // reopening and resubmitting must not pay twice — the ledger is append-only
    // and carries the assessment it came from, so the check is exact
    const already = await db.pointLedger.findFirst({
      where: {
        employeeId: who.subjectId,
        refType: "Assessment",
        refId: assessment.id,
      },
      select: { id: true },
    });
    if (!already) {
      await db.pointLedger.create({
        data: {
          employeeId: who.subjectId,
          delta: SELF_ASSESSMENT_POINTS,
          reason: SELF_ASSESSMENT_REASON,
          refType: "Assessment",
          refId: assessment.id,
        },
      });
      pointsAwarded = SELF_ASSESSMENT_POINTS;
    }
  } else {
    await db.notification.create({
      data: {
        employeeId: who.subjectId,
        kind: "ASSESSMENT",
        channel: "BOTH",
        titleEn: "Your supervisor review has been submitted",
        titleTh: "หัวหน้าของคุณส่งผลการประเมินแล้ว",
        bodyEn: `${who.viewer.name} submitted your ${cycle.nameEn} supervisor review. Open Assessment to see your weighted result and gap analysis.`,
        bodyTh: `${who.viewer.name} ส่งผลการประเมินรอบ ${cycle.nameTh} ของคุณแล้ว เปิดหน้าการประเมินเพื่อดูคะแนนรวมและการวิเคราะห์ส่วนต่าง`,
        href: "/assessment",
      },
    });
  }

  await recordActivity({
    viewer: who.viewer,
    action:
      mode === "self" ? "Submitted self assessment" : "Submitted supervisor review",
    targetType: "Assessment",
    targetId: assessment.id,
    targetLabel: subject?.name ?? who.subjectId,
    detail: `${cycle.nameEn} · ${questions.length} competencies · ${kpis.length} KPI`,
  });

  revalidateResultViews(mode, targetId);
  return { ok: true, pointsAwarded };
}

/* ----------------------------------------------------------------- reopen */

/**
 * Re-open a submitted assessment for another round.
 *
 * The seeded cycle already contains a submitted self *and* supervisor
 * assessment for everybody, so without this every wizard would be permanently
 * read-only. Re-opening is deliberately a separate, explicit action rather than
 * something a stray click can do: it keeps the existing answers as the starting
 * point (they are evidence, not scratch) and only clears `submittedAt`, which
 * withdraws the result from the subject's screens until it is submitted again.
 */
export async function reopenAssessmentAction(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { mode, targetId } = parsed.data;

  let who: Guarded;
  try {
    who = await guard(mode, targetId);
  } catch {
    return { ok: false, error: "not_authorised" };
  }

  const open = await openCycle();
  if (!open.cycle) return { ok: false, error: open.error };
  const { cycle } = open;

  const assessment = await db.assessment.findUnique({
    where: {
      cycleId_subjectId_reviewerId_mode: {
        cycleId: cycle.id,
        subjectId: who.subjectId,
        reviewerId: who.reviewerId,
        mode: dbMode(mode),
      },
    },
    select: { id: true, submittedAt: true },
  });
  if (!assessment) return { ok: false, error: "not_found" };
  if (!assessment.submittedAt) return { ok: false, error: "not_submitted" };

  await db.assessment.update({
    where: { id: assessment.id },
    data: { submittedAt: null },
  });

  const subject = await db.employee.findUnique({
    where: { id: who.subjectId },
    select: { name: true },
  });

  await recordActivity({
    viewer: who.viewer,
    action:
      mode === "self"
        ? "Re-opened self assessment"
        : "Re-opened supervisor review",
    targetType: "Assessment",
    targetId: assessment.id,
    targetLabel: subject?.name ?? who.subjectId,
    detail: `${cycle.nameEn} · previously submitted ${assessment.submittedAt.toISOString()}`,
  });

  revalidateResultViews(mode, targetId);
  return { ok: true };
}
