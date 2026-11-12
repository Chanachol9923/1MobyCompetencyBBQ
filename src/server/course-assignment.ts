import "server-only";
import { db } from "@/lib/db";
import { getAssessedSets, loadAssessmentRules } from "@/server/assessed-competencies";

/**
 * Courses assigned from the assessment ("คอร์ส auto assign ตามคะแนนที่ถูกประเมิน").
 *
 * The inputs are the supervisor's scores (the official result), the levels the
 * person is expected to reach (their assessed set: `assessed-competencies.ts`,
 * career role and job position) and each
 * course's own level — the competency level it brings a learner up to. For
 * every competency where the score is below what the position expects, the
 * published courses on that competency whose level sits between the two are
 * assigned: a 2 against an expected 3 gets the level-3 course; a 1 against an
 * expected 3 gets the level-2 and the level-3 ones, in that order.
 *
 * It is recomputed whenever an input changes, so it never drifts: when a gap
 * closes, an assignment nobody has started is withdrawn; one already started
 * stays, because taking it away mid-way would be worse than finishing it.
 */

type Desired = { courseId: string; competencyId: string; score: number; expected: number };

/** Recompute for these people, or for everyone when no ids are given. */
export async function syncCourseAssignments(employeeIds?: string[]): Promise<{ added: number; removed: number }> {
  const people = await db.employee.findMany({
    where: { active: true, ...(employeeIds ? { id: { in: employeeIds } } : {}) },
    select: { id: true, jobRoleId: true, positionId: true },
  });
  if (!people.length) return { added: 0, removed: 0 };
  const ids = people.map((p) => p.id);

  const [reviews, rules, courses, existing, started] = await Promise.all([
    // the latest submitted supervisor review of each person, whatever the cycle
    db.assessment.findMany({
      where: { mode: "SUPERVISOR", submittedAt: { not: null }, subjectId: { in: ids } },
      orderBy: { submittedAt: "desc" },
      select: { subjectId: true, cycleId: true, scores: { select: { competencyId: true, score: true } } },
    }),
    // read fresh, never from a render cache: this runs right after the rules change
    loadAssessmentRules(),
    db.course.findMany({
      where: { status: "PUBLISHED", level: { not: null }, competencyId: { not: null } },
      orderBy: [{ level: "asc" }, { titleEn: "asc" }],
      select: { id: true, competencyId: true, level: true },
    }),
    db.courseAssignment.findMany({
      where: { employeeId: { in: ids } },
      select: { id: true, employeeId: true, courseId: true, score: true, expected: true },
    }),
    // a course someone has begun is theirs to finish
    db.enrollment.findMany({
      where: { employeeId: { in: ids }, OR: [{ completedAt: { not: null } }, { chapters: { some: {} } }] },
      select: { employeeId: true, courseId: true },
    }),
  ]);

  const latestReview = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) if (!latestReview.has(r.subjectId)) latestReview.set(r.subjectId, r);
  const expectedOf = await getAssessedSets(people, rules);
  const startedKey = new Set(started.map((s) => `${s.employeeId}:${s.courseId}`));

  let added = 0;
  let removed = 0;
  const notify: { employeeId: string; count: number }[] = [];

  for (const person of people) {
    const review = latestReview.get(person.id);
    // no official result yet: nothing to assign from, and nothing is withdrawn
    if (!review) continue;
    const expects = expectedOf.get(person.id) ?? new Map<string, number>();

    const desired = new Map<string, Desired>();
    for (const { competencyId, score } of review.scores) {
      const target = expects.get(competencyId);
      if (target === undefined || score >= target) continue;
      for (const c of courses) {
        if (c.competencyId === competencyId && c.level! > score && c.level! <= target) {
          desired.set(c.id, { courseId: c.id, competencyId, score, expected: target });
        }
      }
    }

    const theirs = existing.filter((e) => e.employeeId === person.id);
    const withdraw = theirs.filter((e) => !desired.has(e.courseId) && !startedKey.has(`${person.id}:${e.courseId}`));
    const create = [...desired.values()].filter((d) => !theirs.some((e) => e.courseId === d.courseId));
    const refresh = theirs.filter((e) => {
      const d = desired.get(e.courseId);
      return d && (d.score !== e.score || d.expected !== e.expected);
    });

    if (!withdraw.length && !create.length && !refresh.length) continue;
    await db.$transaction([
      ...(withdraw.length ? [db.courseAssignment.deleteMany({ where: { id: { in: withdraw.map((w) => w.id) } } })] : []),
      ...(create.length
        ? [
            db.courseAssignment.createMany({
              data: create.map((d) => ({ ...d, employeeId: person.id, cycleId: review.cycleId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...refresh.map((e) => {
        const d = desired.get(e.courseId)!;
        // `select` keeps the returned row to columns that exist before 0016;
        // the due date stays what it was when the course was first assigned
        return db.courseAssignment.update({
          where: { id: e.id },
          data: { score: d.score, expected: d.expected },
          select: { id: true },
        });
      }),
    ]);
    added += create.length;
    removed += withdraw.length;
    if (create.length) notify.push({ employeeId: person.id, count: create.length });
  }

  if (notify.length) {
    await db.notification.createMany({
      data: notify.map((n) => ({
        employeeId: n.employeeId,
        kind: "LMS" as const,
        channel: "IN_APP" as const,
        titleEn: "New courses assigned to you",
        titleTh: "มีคอร์สที่ได้รับมอบหมายใหม่",
        bodyEn: `${n.count} course(s) from your assessment result, to close the gap to your position's expected level. Please finish within ${ASSIGNMENT_DUE_DAYS} days.`,
        bodyTh: `${n.count} คอร์สจากผลการประเมินของคุณ เพื่อปิดช่องว่างให้ถึงระดับที่ตำแหน่งของคุณคาดหวัง กรุณาเรียนให้จบภายใน ${ASSIGNMENT_DUE_DAYS} วัน`,
        href: "/lms",
      })),
    });
  }
  return { added, removed };
}

export type AssignedCourse = {
  courseId: string;
  competencyId: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  score: number;
  expected: number;
  assignedAt: string;
  /** when it should be finished (ISO) */
  dueAt: string;
  /** decided on the server, so both renders of the page agree */
  overdue: boolean;
};

/** An assignment is due this long after it was made. */
export const ASSIGNMENT_DUE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `CourseAssignment.dueAt` exists yet (migration 0016), asked once
 * rather than per query; an absence is re-checked after a minute.
 */
let dueColumnSeen: { exists: boolean; at: number } | null = null;
async function dueColumnExists(): Promise<boolean> {
  if (dueColumnSeen && (dueColumnSeen.exists || Date.now() - dueColumnSeen.at < 60_000)) {
    return dueColumnSeen.exists;
  }
  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'CourseAssignment' AND column_name = 'dueAt'
    ) AS "exists"`;
  dueColumnSeen = { exists: Boolean(rows[0]?.exists), at: Date.now() };
  return dueColumnSeen.exists;
}

/**
 * The due date of each assignment, by id. Read with raw SQL so the typed
 * queries never name a column the database may not have yet; without it the
 * date is the rule itself, `createdAt` + 30 days — the same value 0016 stores.
 */
export async function dueDatesOf(
  rows: { id: string; createdAt: Date }[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  for (const r of rows) {
    out.set(r.id, new Date(r.createdAt.getTime() + ASSIGNMENT_DUE_DAYS * DAY_MS));
  }
  if (!rows.length || !(await dueColumnExists())) return out;
  const stored = await db.$queryRaw<{ id: string; dueAt: Date }[]>`
    SELECT "id", "dueAt" FROM "CourseAssignment" WHERE "id" = ANY(${rows.map((r) => r.id)})`;
  for (const s of stored) out.set(s.id, s.dueAt);
  return out;
}

/** What one person has been assigned, by course. */
export async function getAssignments(employeeId: string): Promise<Map<string, AssignedCourse>> {
  const rows = await db.courseAssignment.findMany({
    where: { employeeId },
    select: {
      id: true,
      courseId: true,
      competencyId: true,
      score: true,
      expected: true,
      createdAt: true,
      competency: { select: { nameEn: true, nameTh: true } },
    },
  });
  const due = await dueDatesOf(rows);
  const now = Date.now();
  return new Map(
    rows.map((r) => {
      const dueAt = due.get(r.id)!;
      return [
        r.courseId,
        {
          courseId: r.courseId,
          competencyId: r.competencyId,
          competencyNameEn: r.competency.nameEn,
          competencyNameTh: r.competency.nameTh,
          score: r.score,
          expected: r.expected,
          assignedAt: r.createdAt.toISOString(),
          dueAt: dueAt.toISOString(),
          overdue: dueAt.getTime() < now,
        },
      ];
    }),
  );
}
