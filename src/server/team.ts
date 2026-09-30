import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getActiveCycle,
  getGapRows,
  verdictFor,
  type GapRow,
  type GapVerdict,
} from "@/server/competency";

/**
 * Queries the Dashboard, Team Profile and Reports screens need on top of the
 * gap engine.
 *
 * Two rules shape everything here:
 *   - the gap engine in `competency.ts` stays the single definition of a gap, a
 *     verdict and "not assessed"; nothing below re-derives them;
 *   - a screen that can grow past a handful of rows gets an aggregate query,
 *     not a loop. `getTeamSummaries` is fine for six direct reports;
 *     `/reports` at company scope is not, so it runs `getScopeReport` instead,
 *     which rolls the whole scope up in the database and never ships a row per
 *     employee to the browser.
 */

/* ------------------------------------------------------- competency labels */

export type CompetencyMeta = {
  id: string;
  key: string;
  group: "CORE" | "FUNCTIONAL" | "MANAGERIAL";
  nameEn: string;
  nameTh: string | null;
  definitionEn: string | null;
  definitionTh: string | null;
  sortOrder: number;
};

/**
 * All 13 competencies, once per request. Every screen needs the Thai names and
 * the framework only ever has a couple of dozen rows, so one cached read beats
 * joining the text onto every aggregate.
 */
export const getCompetencyDictionary = cache(
  async (): Promise<Map<string, CompetencyMeta>> => {
    const rows = await db.competency.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        key: true,
        group: true,
        nameEn: true,
        nameTh: true,
        definitionEn: true,
        definitionTh: true,
        sortOrder: true,
      },
    });
    return new Map(rows.map((c) => [c.id, c]));
  },
);

/** A gap row carrying the Thai name, so the client can pick by language. */
export type NamedGapRow = GapRow & { nameTh: string | null };

export async function getNamedGapRows(
  employeeId: string,
): Promise<NamedGapRow[]> {
  const [rows, dict] = await Promise.all([
    getGapRows(employeeId),
    getCompetencyDictionary(),
  ]);
  return rows.map((r) => ({
    ...r,
    nameTh: dict.get(r.competencyId)?.nameTh ?? null,
  }));
}

/* --------------------------------------------------------- direct reports */

export type TeamMember = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  level: string;
};

/** Active direct reports of a manager, in name order. */
export const getDirectReports = cache(
  async (managerId: string): Promise<TeamMember[]> => {
    const rows = await db.employee.findMany({
      where: { managerId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nickname: true,
        position: { select: { name: true } },
        jobRole: { select: { name: true, level: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      nickname: r.nickname,
      position: r.position?.name ?? null,
      jobRole: r.jobRole.name,
      level: r.jobRole.level,
    }));
  },
);

/* ----------------------------------------------------------- team heat map */

export type HeatCell = {
  /** null means this person's career role is not assessed on this competency */
  expected: number | null;
  self: number | null;
  manager: number | null;
  score: number | null;
};

export type TeamMatrix = {
  /** the union of competencies at least one member is assessed on */
  competencies: CompetencyMeta[];
  /** employeeId → competencyId → cell */
  cells: Map<string, Map<string, HeatCell>>;
};

/**
 * The whole heat map in two round trips regardless of team size — expected
 * levels per career role, then every score in the cycle for those people at once.
 * Competencies nobody in the team is assessed on never get a column, and a
 * member who is not assessed on a column has no cell (the table renders "N/A").
 */
export async function getTeamMatrix(
  employeeIds: string[],
): Promise<TeamMatrix> {
  const empty: TeamMatrix = { competencies: [], cells: new Map() };
  if (employeeIds.length === 0) return empty;

  // two round trips whatever the team size: people with their role's
  // expectations (and the cycle and dictionary) together, then the scores
  const [cycle, people, dict] = await Promise.all([
    getActiveCycle(),
    db.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        jobRoleId: true,
        jobRole: {
          select: {
            expectedLevels: {
              where: { level: { not: null } },
              select: { competencyId: true, level: true },
            },
          },
        },
      },
    }),
    getCompetencyDictionary(),
  ]);
  if (!cycle || people.length === 0) return empty;
  const employees = people.map((e) => ({ id: e.id, jobRoleId: e.jobRoleId }));
  const expected = people.flatMap((e) =>
    e.jobRole.expectedLevels.map((x) => ({ jobRoleId: e.jobRoleId, ...x })),
  );

  const assessments = await db.assessment.findMany({
    where: { cycleId: cycle.id, subjectId: { in: employeeIds } },
    select: {
      subjectId: true,
      mode: true,
      scores: { select: { competencyId: true, score: true } },
    },
  });

  // jobRoleId → competencyId → expected level
  const expectedBy = new Map<string, Map<string, number>>();
  for (const e of expected) {
    if (e.level === null) continue;
    let byRole = expectedBy.get(e.jobRoleId);
    if (!byRole) expectedBy.set(e.jobRoleId, (byRole = new Map()));
    byRole.set(e.competencyId, e.level);
  }

  // subjectId → competencyId → { self, manager }
  const scoreBy = new Map<string, Map<string, { self?: number; manager?: number }>>();
  for (const a of assessments) {
    let byComp = scoreBy.get(a.subjectId);
    if (!byComp) scoreBy.set(a.subjectId, (byComp = new Map()));
    for (const s of a.scores) {
      const cell = byComp.get(s.competencyId) ?? {};
      if (a.mode === "SELF") cell.self = s.score;
      else cell.manager = s.score;
      byComp.set(s.competencyId, cell);
    }
  }

  const used = new Set<string>();
  const cells = new Map<string, Map<string, HeatCell>>();
  for (const employee of employees) {
    const byRole = expectedBy.get(employee.jobRoleId);
    const row = new Map<string, HeatCell>();
    if (byRole) {
      for (const [competencyId, level] of byRole) {
        used.add(competencyId);
        const scores = scoreBy.get(employee.id)?.get(competencyId);
        const self = scores?.self ?? null;
        const manager = scores?.manager ?? null;
        row.set(competencyId, {
          expected: level,
          self,
          manager,
          score: manager ?? self,
        });
      }
    }
    cells.set(employee.id, row);
  }

  const competencies = [...dict.values()]
    .filter((c) => used.has(c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { competencies, cells };
}

/* -------------------------------------------------------- development plan */

export type GoalRow = {
  id: string;
  employeeId: string;
  competencyId: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  courseId: string | null;
  /** the LMS route key — Course.slug, which is what /lms/[courseId] expects */
  courseSlug: string | null;
  courseTitleEn: string | null;
  courseTitleTh: string | null;
  fromLevel: number;
  toLevel: number;
  activity: "ONLINE_COURSE" | "COACHING" | "ON_THE_JOB";
  /** yyyy-mm-dd, so a date input can round-trip it without a timezone shift */
  startDate: string;
  dueDate: string;
  remark: string | null;
  /** 0-100, from the course's chapters when there is one, else the manual value */
  progress: number;
  complete: boolean;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One person's development plan with real progress: a goal backed by a course
 * reads its percentage off that person's chapter completions, and a goal that
 * is not backed by a course carries its own manual figure. Two queries, no
 * matter how many goals.
 */
export async function getGoalRows(employeeId: string): Promise<GoalRow[]> {
  const byEmployee = await getGoalRowsForMany([employeeId]);
  return byEmployee.get(employeeId) ?? [];
}

/**
 * The same thing for a whole team, still in two queries — the Team Profile
 * preloads every report's plan so switching member does not hit the database
 * again.
 */
export async function getGoalRowsForMany(
  employeeIds: string[],
): Promise<Map<string, GoalRow[]>> {
  const out = new Map<string, GoalRow[]>();
  for (const id of employeeIds) out.set(id, []);
  if (employeeIds.length === 0) return out;

  const goals = await db.idpGoal.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      employeeId: true,
      competencyId: true,
      courseId: true,
      fromLevel: true,
      toLevel: true,
      activity: true,
      startDate: true,
      dueDate: true,
      remark: true,
      manualProgress: true,
      completedAt: true,
      competency: { select: { nameEn: true, nameTh: true } },
      course: {
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleTh: true,
          _count: { select: { chapters: true } },
        },
      },
    },
  });
  if (goals.length === 0) return out;

  const courseIds = [
    ...new Set(goals.map((g) => g.courseId).filter((id): id is string => !!id)),
  ];
  const enrollments = courseIds.length
    ? await db.enrollment.findMany({
        where: { employeeId: { in: employeeIds }, courseId: { in: courseIds } },
        select: {
          employeeId: true,
          courseId: true,
          completedAt: true,
          _count: { select: { chapters: true } },
        },
      })
    : [];
  const doneBy = new Map(
    enrollments.map((e) => [`${e.employeeId}:${e.courseId}`, e]),
  );

  for (const g of goals) {
    let progress = g.manualProgress;
    if (g.course) {
      const enrollment = doneBy.get(`${g.employeeId}:${g.course.id}`);
      const total = g.course._count.chapters;
      if (enrollment?.completedAt) progress = 100;
      else if (enrollment && total > 0) {
        progress = Math.round((enrollment._count.chapters / total) * 100);
      } else if (!enrollment) progress = 0;
    }
    if (g.completedAt) progress = 100;
    out.get(g.employeeId)?.push({
      id: g.id,
      employeeId: g.employeeId,
      competencyId: g.competencyId,
      competencyNameEn: g.competency.nameEn,
      competencyNameTh: g.competency.nameTh,
      courseId: g.courseId,
      courseSlug: g.course?.slug ?? null,
      courseTitleEn: g.course?.titleEn ?? null,
      courseTitleTh: g.course?.titleTh ?? null,
      fromLevel: g.fromLevel,
      toLevel: g.toLevel,
      activity: g.activity,
      startDate: isoDate(g.startDate),
      dueDate: isoDate(g.dueDate),
      remark: g.remark,
      progress: Math.max(0, Math.min(100, progress)),
      complete: g.completedAt !== null || progress >= 100,
    });
  }
  return out;
}

/** Every direct report's coaching note from this manager, in one query. */
export async function getCoachingNotes(
  subjectIds: string[],
  authorId: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (subjectIds.length === 0) return out;
  const notes = await db.coachingNote.findMany({
    where: { authorId, subjectId: { in: subjectIds } },
    select: { subjectId: true, body: true },
  });
  for (const n of notes) out.set(n.subjectId, n.body);
  return out;
}

export type CourseOption = {
  id: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  competencyId: string | null;
};

/** The published catalogue, for the goal form's course picker. */
export const getCourseOptions = cache(async (): Promise<CourseOption[]> => {
  return db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { titleEn: "asc" },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleTh: true,
      competencyId: true,
    },
  });
});

/** The first published course written for a competency, if there is one. */
export async function getCourseByCompetency(): Promise<
  Map<string, CourseOption>
> {
  const courses = await getCourseOptions();
  const byCompetency = new Map<string, CourseOption>();
  for (const c of courses) {
    if (c.competencyId && !byCompetency.has(c.competencyId)) {
      byCompetency.set(c.competencyId, c);
    }
  }
  return byCompetency;
}

/* --------------------------------------------------------- review progress */

/**
 * When this manager submitted a supervisor assessment for each report, in one
 * query rather than one per member.
 */
export async function getReviewStatus(
  reviewerId: string,
  subjectIds: string[],
): Promise<Map<string, Date | null>> {
  const out = new Map<string, Date | null>();
  if (subjectIds.length === 0) return out;
  const cycle = await getActiveCycle();
  if (!cycle) return out;

  const rows = await db.assessment.findMany({
    where: {
      cycleId: cycle.id,
      reviewerId,
      mode: "SUPERVISOR",
      subjectId: { in: subjectIds },
    },
    select: { subjectId: true, submittedAt: true },
  });
  for (const r of rows) out.set(r.subjectId, r.submittedAt);
  return out;
}

/* --------------------------------------------------------- team learning */

export type LearningRow = {
  employeeId: string;
  courseTitleEn: string | null;
  courseTitleTh: string | null;
  hours: number;
  /** 0-100 across every course this person is enrolled in */
  progress: number;
  enrolledCount: number;
  completedCount: number;
  lastActivity: Date | null;
};

/**
 * LMS activity per team member, built from enrolments and chapter completions.
 * Nobody is enrolled in the seeded data yet, so this legitimately comes back
 * empty — it is not padded with invented percentages.
 */
export async function getTeamLearning(
  employeeIds: string[],
): Promise<Map<string, LearningRow>> {
  const out = new Map<string, LearningRow>();
  if (employeeIds.length === 0) return out;

  const enrollments = await db.enrollment.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { startedAt: "desc" },
    select: {
      employeeId: true,
      startedAt: true,
      completedAt: true,
      course: {
        select: {
          titleEn: true,
          titleTh: true,
          hours: true,
          _count: { select: { chapters: true } },
        },
      },
      chapters: { select: { completedAt: true } },
    },
  });

  for (const id of employeeIds) {
    out.set(id, {
      employeeId: id,
      courseTitleEn: null,
      courseTitleTh: null,
      hours: 0,
      progress: 0,
      enrolledCount: 0,
      completedCount: 0,
      lastActivity: null,
    });
  }

  const totals = new Map<string, { sum: number; n: number }>();
  for (const e of enrollments) {
    const row = out.get(e.employeeId);
    if (!row) continue;
    const total = e.course._count.chapters;
    const done = e.chapters.length;
    const percent = e.completedAt
      ? 100
      : total > 0
        ? Math.round((done / total) * 100)
        : 0;

    // the newest enrolment is the "current course" — the list is sorted desc
    if (row.enrolledCount === 0) {
      row.courseTitleEn = e.course.titleEn;
      row.courseTitleTh = e.course.titleTh;
      row.hours = e.course.hours;
    }
    row.enrolledCount += 1;
    if (e.completedAt) row.completedCount += 1;

    const latest = e.chapters.reduce<Date | null>(
      (a, c) => (a === null || c.completedAt > a ? c.completedAt : a),
      e.completedAt ?? e.startedAt,
    );
    if (latest && (row.lastActivity === null || latest > row.lastActivity)) {
      row.lastActivity = latest;
    }

    const acc = totals.get(e.employeeId) ?? { sum: 0, n: 0 };
    acc.sum += percent;
    acc.n += 1;
    totals.set(e.employeeId, acc);
  }

  for (const [id, acc] of totals) {
    const row = out.get(id);
    if (row && acc.n) row.progress = Math.round(acc.sum / acc.n);
  }
  return out;
}

/* ----------------------------------------------------------------- points */

/** Points balance and badge count for the dashboard's achievements card. */
export async function getEngagement(employeeId: string) {
  const [points, badges] = await Promise.all([
    db.pointLedger.aggregate({
      where: { employeeId },
      _sum: { delta: true },
    }),
    db.employeeBadge.findMany({
      where: { employeeId },
      orderBy: { earnedAt: "desc" },
      take: 4,
      select: {
        earnedAt: true,
        badge: {
          select: { key: true, nameEn: true, nameTh: true, points: true, tone: true },
        },
      },
    }),
  ]);
  return { points: points._sum.delta ?? 0, badges };
}

/* ------------------------------------------------------------- org filters */

export const getOrgFilters = cache(async () => {
  const [departments, divisions] = await Promise.all([
    db.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { employees: true } },
      },
    }),
    db.division.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, departmentId: true },
    }),
  ]);
  return { departments, divisions };
});

/* ---------------------------------------------------- the aggregate report */

export type ScopeFilter =
  | { kind: "people"; employeeIds: string[] }
  | { kind: "company"; departmentId?: string | null; divisionId?: string | null };

export type ReportAggRow = {
  competencyId: string;
  nameEn: string;
  nameTh: string | null;
  group: "CORE" | "FUNCTIONAL" | "MANAGERIAL";
  avgScore: number;
  avgSelf: number;
  avgExpected: number;
  gap: number;
  verdict: GapVerdict;
  assessedCount: number;
  belowCount: number;
  topName: string | null;
  topScore: number;
};

export type ReportPerson = {
  employeeId: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  department: string | null;
  avgGap: number;
  criticalCount: number;
  worstNameEn: string | null;
  worstNameTh: string | null;
  worstGap: number | null;
};

export type ScopeReport = {
  headcount: number;
  rows: ReportAggRow[];
  /** worst average gap first — bounded, never the whole company */
  people: ReportPerson[];
  /** true when `people` is a top slice rather than everybody in scope */
  peopleTruncated: boolean;
};

const EMPTY_REPORT: ScopeReport = {
  headcount: 0,
  rows: [],
  people: [],
  peopleTruncated: false,
};

/** How many individuals a report will ever ship to the browser. */
export const PEOPLE_LIMIT = 50;

const round2 = (n: number) => Number(n.toFixed(2));

type CompetencyAggregate = {
  competencyId: string;
  assessedCount: number;
  scoredCount: number;
  avgScore: number | null;
  avgSelf: number | null;
  avgExpected: number;
  belowCount: number;
  topEmployeeId: string | null;
  topScore: number | null;
};

type PersonAggregate = {
  employeeId: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  department: string | null;
  avgGap: number | null;
  criticalCount: number;
  worstCompetencyId: string | null;
  worstGap: number | null;
};

/**
 * The whole report, rolled up in Postgres.
 *
 * Both halves run off the same `scored` CTE: one row per (person, competency)
 * the person's career role is actually assessed on, with the official score
 * (supervisor where it exists, otherwise self) and the expected level beside
 * it. A competency the role has no expected level for never enters the CTE, so
 * it can never be averaged in as a zero.
 *
 * The browser gets at most one row per competency plus a bounded slice of
 * people — a company of ten thousand costs the same three queries as a team of
 * six.
 */
export async function getScopeReport(
  filter: ScopeFilter,
): Promise<ScopeReport> {
  const cycle = await getActiveCycle();
  if (!cycle) return EMPTY_REPORT;
  if (filter.kind === "people" && filter.employeeIds.length === 0) {
    return EMPTY_REPORT;
  }

  const where =
    filter.kind === "people"
      ? Prisma.sql`e.id IN (${Prisma.join(filter.employeeIds)})`
      : Prisma.sql`TRUE ${
          filter.departmentId
            ? Prisma.sql`AND e."departmentId" = ${filter.departmentId}`
            : Prisma.empty
        } ${
          filter.divisionId
            ? Prisma.sql`AND e."divisionId" = ${filter.divisionId}`
            : Prisma.empty
        }`;

  /** One row per (person, competency) that person is assessed on. */
  const scored = Prisma.sql`
    WITH scope AS (
      SELECT e.id, e."jobRoleId"
      FROM "Employee" e
      WHERE e.active = true AND ${where}
    ),
    cell AS (
      SELECT
        s.id                                                   AS employee_id,
        el."competencyId"                                      AS competency_id,
        el.level                                               AS expected,
        MAX(CASE WHEN a.mode = 'SUPERVISOR' THEN sc.score END) AS mgr,
        MAX(CASE WHEN a.mode = 'SELF'       THEN sc.score END) AS slf
      FROM scope s
      JOIN "ExpectedLevel" el
        ON el."jobRoleId" = s."jobRoleId" AND el.level IS NOT NULL
      LEFT JOIN "Assessment" a
        ON a."subjectId" = s.id AND a."cycleId" = ${cycle.id}
      LEFT JOIN "AssessmentScore" sc
        ON sc."assessmentId" = a.id AND sc."competencyId" = el."competencyId"
      GROUP BY s.id, el."competencyId", el.level
    ),
    scored AS (
      SELECT employee_id, competency_id, expected, slf,
             COALESCE(mgr, slf) AS score
      FROM cell
    )`;

  const [headcount, byCompetency, byPerson] = await Promise.all([
    filter.kind === "people"
      ? db.employee.count({
          where: { active: true, id: { in: filter.employeeIds } },
        })
      : db.employee.count({
          where: {
            active: true,
            ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
            ...(filter.divisionId ? { divisionId: filter.divisionId } : {}),
          },
        }),

    db.$queryRaw<CompetencyAggregate[]>`
      ${scored}
      SELECT
        competency_id                                                  AS "competencyId",
        COUNT(*)::int                                                  AS "assessedCount",
        COUNT(score)::int                                              AS "scoredCount",
        AVG(score)::float8                                             AS "avgScore",
        AVG(slf)::float8                                               AS "avgSelf",
        AVG(expected)::float8                                          AS "avgExpected",
        COUNT(*) FILTER (WHERE score IS NOT NULL AND score < expected)::int
                                                                       AS "belowCount",
        -- employee_id breaks the tie so the same scope always names the same
        -- top scorer rather than whichever row the planner happened to emit
        (array_agg(employee_id ORDER BY score DESC NULLS LAST, employee_id))[1]
                                                                       AS "topEmployeeId",
        MAX(score)::float8                                             AS "topScore"
      FROM scored
      GROUP BY competency_id`,

    db.$queryRaw<PersonAggregate[]>`
      ${scored}
      SELECT
        p.employee_id                                                  AS "employeeId",
        emp.name                                                       AS "name",
        emp.nickname                                                   AS "nickname",
        pos.name                                                       AS "position",
        jr.name                                                        AS "jobRole",
        dep.name                                                       AS "department",
        p."avgGap", p."criticalCount", p."worstCompetencyId", p."worstGap"
      FROM (
        SELECT
          employee_id,
          AVG(score - expected)::float8 AS "avgGap",
          COUNT(*) FILTER (
            WHERE score IS NOT NULL AND (score - expected) <= -1
          )::int AS "criticalCount",
          (array_agg(
             competency_id ORDER BY (score - expected) ASC NULLS LAST, competency_id
           ))[1] AS "worstCompetencyId",
          MIN(score - expected)::float8 AS "worstGap"
        FROM scored
        GROUP BY employee_id
      ) p
      JOIN "Employee" emp ON emp.id = p.employee_id
      JOIN "JobRole"  jr  ON jr.id  = emp."jobRoleId"
      LEFT JOIN "Position"   pos ON pos.id = emp."positionId"
      LEFT JOIN "Department" dep ON dep.id = emp."departmentId"
      ORDER BY p."avgGap" ASC NULLS LAST, emp.name ASC
      LIMIT ${PEOPLE_LIMIT + 1}`,
  ]);

  const dict = await getCompetencyDictionary();

  // the top scorer's name — at most one extra lookup, bounded by the framework
  const topIds = [
    ...new Set(
      byCompetency
        .map((r) => r.topEmployeeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const topPeople = topIds.length
    ? await db.employee.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, nickname: true },
      })
    : [];
  const topById = new Map(topPeople.map((p) => [p.id, p]));

  const rows: ReportAggRow[] = byCompetency
    .map((r) => {
      const meta = dict.get(r.competencyId);
      const avgScore = round2(r.avgScore ?? 0);
      const avgExpected = round2(r.avgExpected);
      const gap = round2(avgScore - avgExpected);
      // array_agg still returns somebody when every score is null — only call
      // it a top scorer when there is actually a score behind it
      const top =
        r.topEmployeeId && r.topScore !== null
          ? topById.get(r.topEmployeeId)
          : undefined;
      return {
        competencyId: r.competencyId,
        nameEn: meta?.nameEn ?? r.competencyId,
        nameTh: meta?.nameTh ?? null,
        group: meta?.group ?? "CORE",
        avgScore,
        avgSelf: round2(r.avgSelf ?? 0),
        avgExpected,
        gap,
        verdict: verdictFor(gap),
        assessedCount: r.assessedCount,
        belowCount: r.belowCount,
        topName: top ? (top.nickname ?? top.name) : null,
        topScore: r.topScore ?? 0,
        sortOrder: meta?.sortOrder ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...row }) => row);

  const peopleTruncated = byPerson.length > PEOPLE_LIMIT;
  const people: ReportPerson[] = byPerson.slice(0, PEOPLE_LIMIT).map((p) => {
    const worst = p.worstCompetencyId ? dict.get(p.worstCompetencyId) : undefined;
    return {
      employeeId: p.employeeId,
      name: p.name,
      nickname: p.nickname,
      position: p.position,
      jobRole: p.jobRole,
      department: p.department,
      avgGap: round2(p.avgGap ?? 0),
      criticalCount: p.criticalCount,
      worstNameEn: worst?.nameEn ?? null,
      worstNameTh: worst?.nameTh ?? null,
      worstGap: p.worstGap === null ? null : round2(p.worstGap),
    };
  });

  return { headcount, rows, people, peopleTruncated };
}
