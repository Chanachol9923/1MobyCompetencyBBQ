import "server-only";
import { db } from "@/lib/db";
import { isoDateTz } from "@/lib/datetime";
import { getGoalRowsForMany } from "@/server/team";
import { courseProgress } from "@/server/learning";
import { dueDatesOf } from "@/server/course-assignment";

/**
 * In-app reminders before a deadline: 7 days and 1 day before an IDP goal's
 * due date and before an assigned course's due date. Run once a day from the
 * existing cron route (`/api/keepalive`); the free Vercel plan has no room for
 * another cron.
 *
 * Each reminder is sent once. There is no ledger table for it: the
 * notification itself is the record. Its `href` carries the item and the stage
 * (`?remind=7` / `?remind=1`), so before sending, the job looks for a
 * notification to the same person with the same href created since the
 * reminder window opened. A missed day catches up the next day; moving a due
 * date later opens a new window, so the reminder comes again for the new date.
 *
 * In-app only: nothing is emailed (see lib/delivery.ts).
 */

type Stage = 7 | 1;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from today (Bangkok) to `dueDay` (YYYY-MM-DD). */
function daysUntil(dueDay: string, today: string) {
  return Math.round((Date.parse(`${dueDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** 2-7 days left: the week reminder; 0-1 left: the last one. */
function stageFor(daysLeft: number): Stage | null {
  if (daysLeft >= 2 && daysLeft <= 7) return 7;
  if (daysLeft >= 0 && daysLeft <= 1) return 1;
  return null;
}

export type Candidate = {
  employeeId: string;
  /** the page the reminder opens, without the stage */
  base: string;
  stage: Stage;
  daysLeft: number;
  dueDay: string;
  kind: "IDP" | "LMS";
  nameEn: string;
  nameTh: string;
};

const hrefOf = (c: { base: string; stage: Stage }) =>
  `${c.base}${c.base.includes("?") ? "&" : "?"}remind=${c.stage}`;

function whenEn(daysLeft: number) {
  return daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
}
function whenTh(daysLeft: number) {
  return daysLeft <= 0 ? "วันนี้" : daysLeft === 1 ? "พรุ่งนี้" : `ในอีก ${daysLeft} วัน`;
}

/** The reminders due today that have not gone out yet. Reads only. */
export async function planDeadlineReminders(now = new Date()): Promise<Candidate[]> {
  const today = isoDateTz(now.toISOString());
  // anything due from yesterday to 8 days out may need a reminder today
  const from = new Date(now.getTime() - 2 * DAY_MS);
  const to = new Date(now.getTime() + 9 * DAY_MS);
  const candidates: Candidate[] = [];

  /* ---------------------------------------------------------- IDP goals */
  const goals = await db.idpGoal.findMany({
    where: { completedAt: null, dueDate: { gte: from, lte: to }, employee: { active: true } },
    select: { id: true, employeeId: true },
  });
  if (goals.length) {
    const wanted = new Set(goals.map((g) => g.id));
    // progress as the IDP page shows it: a course-backed goal is done when the course is
    const rows = await getGoalRowsForMany([...new Set(goals.map((g) => g.employeeId))]);
    for (const list of rows.values()) {
      for (const g of list) {
        if (!wanted.has(g.id) || g.complete) continue;
        const daysLeft = daysUntil(g.dueDate, today);
        const stage = stageFor(daysLeft);
        if (!stage) continue;
        candidates.push({
          employeeId: g.employeeId,
          base: `/idp?goal=${g.id}`,
          stage,
          daysLeft,
          dueDay: g.dueDate,
          kind: "IDP",
          nameEn: g.courseTitleEn ?? g.competencyNameEn,
          nameTh: g.courseTitleTh ?? g.courseTitleEn ?? g.competencyNameTh ?? g.competencyNameEn,
        });
      }
    }
  }

  /* --------------------------------------------------- assigned courses */
  // the due date is 30 days after assignment (or the stored dueAt), so only
  // assignments made in the last ~40 days can be near it
  const assignments = await db.courseAssignment.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - 40 * DAY_MS) },
      employee: { active: true },
      course: { status: "PUBLISHED" },
    },
    select: {
      id: true,
      employeeId: true,
      courseId: true,
      createdAt: true,
      course: {
        select: { slug: true, titleEn: true, titleTh: true, _count: { select: { chapters: true } } },
      },
    },
  });
  if (assignments.length) {
    const due = await dueDatesOf(assignments);
    const enrolments = await db.enrollment.findMany({
      where: {
        employeeId: { in: [...new Set(assignments.map((a) => a.employeeId))] },
        courseId: { in: [...new Set(assignments.map((a) => a.courseId))] },
      },
      select: { employeeId: true, courseId: true, completedAt: true, _count: { select: { chapters: true } } },
    });
    const enrolled = new Map(enrolments.map((e) => [`${e.employeeId}:${e.courseId}`, e]));
    for (const a of assignments) {
      const e = enrolled.get(`${a.employeeId}:${a.courseId}`);
      if (e && courseProgress(e._count.chapters, a.course._count.chapters, e.completedAt) >= 100) continue;
      const dueDay = isoDateTz(due.get(a.id)!.toISOString());
      const daysLeft = daysUntil(dueDay, today);
      const stage = stageFor(daysLeft);
      if (!stage) continue;
      candidates.push({
        employeeId: a.employeeId,
        base: `/lms/${a.course.slug}`,
        stage,
        daysLeft,
        dueDay,
        kind: "LMS",
        nameEn: a.course.titleEn,
        nameTh: a.course.titleTh ?? a.course.titleEn,
      });
    }
  }

  if (!candidates.length) return [];

  // what was already sent: the same person and href since that window opened
  // (8 days before the due day covers both stages)
  const sent = await db.notification.findMany({
    where: {
      employeeId: { in: [...new Set(candidates.map((c) => c.employeeId))] },
      href: { in: candidates.flatMap((c) => [hrefOf({ base: c.base, stage: 7 }), hrefOf({ base: c.base, stage: 1 })]) },
      createdAt: { gte: new Date(now.getTime() - 10 * DAY_MS) },
    },
    select: { employeeId: true, href: true, createdAt: true },
  });
  const already = (c: Candidate, stage: Stage) => {
    const href = hrefOf({ base: c.base, stage });
    const windowOpens = Date.parse(`${c.dueDay}T00:00:00Z`) - 8 * DAY_MS;
    return sent.some(
      (s) => s.employeeId === c.employeeId && s.href === href && s.createdAt.getTime() >= windowOpens,
    );
  };
  // the week reminder is pointless once the last one has gone out
  return candidates.filter((c) => !already(c, c.stage) && !(c.stage === 7 && already(c, 1)));
}

/** Send today's reminders; returns how many went out of each kind. */
export async function sendDeadlineReminders(now = new Date()): Promise<{ goals: number; courses: number }> {
  const due = await planDeadlineReminders(now);
  if (!due.length) return { goals: 0, courses: 0 };

  await db.notification.createMany({
    data: due.map((c) => ({
      employeeId: c.employeeId,
      kind: c.kind,
      channel: "IN_APP" as const,
      titleEn:
        c.kind === "IDP"
          ? `Development goal due ${whenEn(c.daysLeft)} — ${c.nameEn}`
          : `Assigned course due ${whenEn(c.daysLeft)} — ${c.nameEn}`,
      titleTh:
        c.kind === "IDP"
          ? `เป้าหมายพัฒนาครบกำหนด${whenTh(c.daysLeft)} — ${c.nameTh}`
          : `คอร์สที่ได้รับมอบหมายครบกำหนด${whenTh(c.daysLeft)} — ${c.nameTh}`,
      bodyEn:
        c.kind === "IDP"
          ? `Your development goal is due on ${c.dueDay} and is not complete yet.`
          : `This course was assigned from your assessment and is due on ${c.dueDay}. Please finish it before then.`,
      bodyTh:
        c.kind === "IDP"
          ? `เป้าหมายพัฒนาของคุณครบกำหนดวันที่ ${c.dueDay} และยังไม่เสร็จ`
          : `คอร์สนี้ได้รับมอบหมายจากผลประเมินของคุณ ครบกำหนดวันที่ ${c.dueDay} กรุณาเรียนให้จบก่อนวันดังกล่าว`,
      href: hrefOf(c),
    })),
  });

  return {
    goals: due.filter((c) => c.kind === "IDP").length,
    courses: due.filter((c) => c.kind === "LMS").length,
  };
}
