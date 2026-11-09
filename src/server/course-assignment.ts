import "server-only";
import { db } from "@/lib/db";

/**
 * Courses assigned from the assessment ("คอร์ส auto assign ตามคะแนนที่ถูกประเมิน").
 *
 * The inputs are the supervisor's scores (the official result), the levels the
 * person's position expects (`ExpectedLevel` of their career role) and each
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
    select: { id: true, jobRoleId: true },
  });
  if (!people.length) return { added: 0, removed: 0 };
  const ids = people.map((p) => p.id);

  const [reviews, expected, courses, existing, started] = await Promise.all([
    // the latest submitted supervisor review of each person, whatever the cycle
    db.assessment.findMany({
      where: { mode: "SUPERVISOR", submittedAt: { not: null }, subjectId: { in: ids } },
      orderBy: { submittedAt: "desc" },
      select: { subjectId: true, cycleId: true, scores: { select: { competencyId: true, score: true } } },
    }),
    db.expectedLevel.findMany({
      where: { jobRoleId: { in: [...new Set(people.map((p) => p.jobRoleId))] }, level: { not: null } },
      select: { jobRoleId: true, competencyId: true, level: true },
    }),
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
  const expectedOf = new Map<string, Map<string, number>>();
  for (const e of expected) {
    const m = expectedOf.get(e.jobRoleId) ?? new Map<string, number>();
    m.set(e.competencyId, e.level!);
    expectedOf.set(e.jobRoleId, m);
  }
  const startedKey = new Set(started.map((s) => `${s.employeeId}:${s.courseId}`));

  let added = 0;
  let removed = 0;
  const notify: { employeeId: string; count: number }[] = [];

  for (const person of people) {
    const review = latestReview.get(person.id);
    // no official result yet: nothing to assign from, and nothing is withdrawn
    if (!review) continue;
    const expects = expectedOf.get(person.jobRoleId) ?? new Map<string, number>();

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
        return db.courseAssignment.update({ where: { id: e.id }, data: { score: d.score, expected: d.expected } });
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
        bodyEn: `${n.count} course(s) from your assessment result, to close the gap to your position's expected level.`,
        bodyTh: `${n.count} คอร์สจากผลการประเมินของคุณ เพื่อปิดช่องว่างให้ถึงระดับที่ตำแหน่งของคุณคาดหวัง`,
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
};

/** What one person has been assigned, by course. */
export async function getAssignments(employeeId: string): Promise<Map<string, AssignedCourse>> {
  const rows = await db.courseAssignment.findMany({
    where: { employeeId },
    select: {
      courseId: true,
      competencyId: true,
      score: true,
      expected: true,
      createdAt: true,
      competency: { select: { nameEn: true, nameTh: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.courseId,
      {
        courseId: r.courseId,
        competencyId: r.competencyId,
        competencyNameEn: r.competency.nameEn,
        competencyNameTh: r.competency.nameTh,
        score: r.score,
        expected: r.expected,
        assignedAt: r.createdAt.toISOString(),
      },
    ]),
  );
}
