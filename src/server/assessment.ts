import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getActiveCycle, verdictFor, type GapVerdict } from "@/server/competency";

/**
 * Everything the 180° assessment reads out of Postgres.
 *
 * The answers live in `Assessment` / `AssessmentScore`, and this module is the
 * only place that knows how those tables fit together. The score is
 * competencies only: KPIs are run outside this system.
 *
 * Three rules are enforced here so no screen can get them wrong:
 *
 *   1. the steps of a wizard come from the *target's* career role through
 *      `ExpectedLevel`. A competency with a null expected level is not assessed
 *      and never appears — not as a step, not as a row, not as a zero;
 *   2. a self assessment is always `subjectId === reviewerId`; a supervisor
 *      assessment is always written by the subject's own manager;
 *   3. an assessment carries its answers as they are made. `submittedAt` is the
 *      only thing "submit" changes, so a half-finished assessment survives a
 *      refresh and a submitted one can be re-read.
 *
 * Nothing in here authorises anything — the pages and actions above call the
 * guards in `session.ts` before they get this far.
 */

export type Mode = "self" | "supervisor";

export const MODES: Mode[] = ["self", "supervisor"];

export const isMode = (value: string): value is Mode =>
  value === "self" || value === "supervisor";

/** The database enum for a mode. */
export const dbMode = (mode: Mode): "SELF" | "SUPERVISOR" =>
  mode === "self" ? "SELF" : "SUPERVISOR";

export type CompetencyGroup = "CORE" | "FUNCTIONAL" | "MANAGERIAL";

export type AssessmentStatus = "not-started" | "in-progress" | "submitted";

/* ------------------------------------------------------------------ cycle */

export type CycleSummary = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  /** ISO, so the value survives the server → client boundary */
  startsAt: string;
  endsAt: string;
  status: "DRAFT" | "OPEN" | "REVIEW" | "CLOSED";
  /** whole percentages of the competency groups, set by HR; they sum to 100 */
  weights: {
    core: number;
    functional: number;
    managerial: number;
  };
};

type CycleRow = NonNullable<Awaited<ReturnType<typeof getActiveCycle>>>;

export function toCycleSummary(cycle: CycleRow): CycleSummary {
  return {
    id: cycle.id,
    key: cycle.key,
    nameEn: cycle.nameEn,
    nameTh: cycle.nameTh,
    startsAt: cycle.startsAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    status: cycle.status,
    weights: {
      core: cycle.weightCore,
      functional: cycle.weightFunctional,
      managerial: cycle.weightManagerial,
    },
  };
}

/* ----------------------------------------------------- the rating scale */

/**
 * What a 1, 2, 3 or 4 means for one competency. The client workbook only ever
 * filled in the Thai columns, and `behaviorTh` carries a `ตัวอย่าง:` worked
 * example the wizard shows behind a disclosure — so the raw text is passed
 * through untouched and split in the browser.
 */
export type LevelDetail = {
  score: number;
  labelEn: string;
  labelTh: string;
  descEn: string | null;
  descTh: string | null;
  behaviorEn: string | null;
  behaviorTh: string | null;
};

export type AssessedCompetency = {
  id: string;
  key: string;
  group: CompetencyGroup;
  nameEn: string;
  nameTh: string | null;
  definitionEn: string | null;
  definitionTh: string | null;
  subTh: string | null;
  indicatorsEn: string[];
  /** never null — rule 1 dropped the rest before this shape was built */
  expected: number;
};

export type CompetencyQuestion = AssessedCompetency & {
  levels: LevelDetail[];
};

/**
 * Every competency this person's career role is assessed on, with the whole
 * rating scale attached. One query: the expected levels for the role, joined to
 * the competency and its four level descriptions.
 */
export const getCompetencyQuestions = cache(
  async (employeeId: string): Promise<CompetencyQuestion[]> => {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { jobRoleId: true },
    });
    if (!employee) return [];

    const rows = await db.expectedLevel.findMany({
      where: { jobRoleId: employee.jobRoleId, level: { not: null } },
      select: {
        level: true,
        competency: {
          select: {
            id: true,
            key: true,
            group: true,
            nameEn: true,
            nameTh: true,
            definitionEn: true,
            definitionTh: true,
            subTh: true,
            indicatorsEn: true,
            sortOrder: true,
            levels: {
              orderBy: { score: "asc" },
              select: {
                score: true,
                labelEn: true,
                labelTh: true,
                descEn: true,
                descTh: true,
                behaviorEn: true,
                behaviorTh: true,
              },
            },
          },
        },
      },
    });

    return rows
      .filter((r) => r.level !== null)
      .sort((a, b) => a.competency.sortOrder - b.competency.sortOrder)
      .map((r) => ({
        id: r.competency.id,
        key: r.competency.key,
        group: r.competency.group,
        nameEn: r.competency.nameEn,
        nameTh: r.competency.nameTh,
        definitionEn: r.competency.definitionEn,
        definitionTh: r.competency.definitionTh,
        subTh: r.competency.subTh,
        indicatorsEn: r.competency.indicatorsEn,
        expected: r.level as number,
        levels: r.competency.levels,
      }));
  },
);

/** The competency ids each of several career roles is assessed on, in one query. */
export async function getAssessedIdsByJobRole(
  jobRoleIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (jobRoleIds.length === 0) return out;
  const rows = await db.expectedLevel.findMany({
    where: { jobRoleId: { in: jobRoleIds }, level: { not: null } },
    select: { jobRoleId: true, competencyId: true },
  });
  for (const r of rows) {
    let set = out.get(r.jobRoleId);
    if (!set) out.set(r.jobRoleId, (set = new Set()));
    set.add(r.competencyId);
  }
  return out;
}

/* ------------------------------------------------------------ assessments */

export type AssessmentRecord = {
  id: string;
  submittedAt: Date | null;
  /** competencyId → 1..4 */
  scores: Map<string, number>;
};

/**
 * One assessment and its answers. `null` when nobody has opened it yet — the
 * row is only created on the first rating, so "not started" stays a real
 * absence rather than an empty record.
 */
export async function findAssessment(input: {
  cycleId: string;
  subjectId: string;
  reviewerId: string;
  mode: Mode;
}): Promise<AssessmentRecord | null> {
  const row = await db.assessment.findUnique({
    where: {
      cycleId_subjectId_reviewerId_mode: {
        cycleId: input.cycleId,
        subjectId: input.subjectId,
        reviewerId: input.reviewerId,
        mode: dbMode(input.mode),
      },
    },
    select: {
      id: true,
      submittedAt: true,
      scores: { select: { competencyId: true, score: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    submittedAt: row.submittedAt,
    scores: new Map(row.scores.map((s) => [s.competencyId, s.score])),
  };
}

/**
 * The supervisor's view of a person, whoever wrote it — the employee's own
 * "your result" card and the self-versus-supervisor comparison both read this.
 * Only a *submitted* review counts: a manager part-way through one is not a
 * result the subject should be reading.
 */
export async function findSubmittedSupervisorReview(
  cycleId: string,
  subjectId: string,
): Promise<{ submittedAt: Date; scores: Map<string, number> } | null> {
  const row = await db.assessment.findFirst({
    where: {
      cycleId,
      subjectId,
      mode: "SUPERVISOR",
      submittedAt: { not: null },
    },
    orderBy: { submittedAt: "desc" },
    select: {
      submittedAt: true,
      scores: { select: { competencyId: true, score: true } },
    },
  });
  if (!row?.submittedAt) return null;
  return {
    submittedAt: row.submittedAt,
    scores: new Map(row.scores.map((s) => [s.competencyId, s.score])),
  };
}

/** The subject's own submitted self assessment, for the supervisor's reference. */
export async function findSubmittedSelfAssessment(
  cycleId: string,
  subjectId: string,
): Promise<{ submittedAt: Date; scores: Map<string, number> } | null> {
  const row = await db.assessment.findFirst({
    where: { cycleId, subjectId, mode: "SELF", submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: {
      submittedAt: true,
      scores: { select: { competencyId: true, score: true } },
    },
  });
  if (!row?.submittedAt) return null;
  return {
    submittedAt: row.submittedAt,
    scores: new Map(row.scores.map((s) => [s.competencyId, s.score])),
  };
}

export function statusOf(
  record: { submittedAt: Date | null; answered: number } | null,
): AssessmentStatus {
  if (!record) return "not-started";
  if (record.submittedAt) return "submitted";
  return record.answered > 0 ? "in-progress" : "not-started";
}

/* ------------------------------------------------------------ the wizard */

export type WizardSubject = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  level: string;
};

export type WizardData = {
  mode: Mode;
  cycle: CycleSummary;
  subject: WizardSubject;
  competencies: CompetencyQuestion[];
  /** competencyId → 1..4, the answers already saved for *this* assessment */
  scores: Record<string, number>;
  submittedAt: string | null;
  /**
   * The other half of the 180°: the supervisor's scores when a self assessment
   * is open, the subject's own when a supervisor review is. Submitted only.
   */
  counterpart: {
    scores: Record<string, number>;
    submittedAt: string;
  } | null;
};

/**
 * Everything one run of the wizard needs, in a handful of queries.
 *
 * The caller has already proved the viewer may open this — `targetId` is never
 * trusted here, it is simply read.
 */
export async function getWizardData(input: {
  mode: Mode;
  targetId: string;
  reviewerId: string;
}): Promise<WizardData | null> {
  const cycle = await getActiveCycle();
  if (!cycle) return null;

  const subject = await db.employee.findUnique({
    where: { id: input.targetId },
    select: {
      id: true,
      name: true,
      nickname: true,
      position: { select: { name: true } },
      jobRole: { select: { name: true, level: true } },
    },
  });
  if (!subject) return null;

  const [competencies, mine, counterpart] = await Promise.all([
    getCompetencyQuestions(subject.id),
    findAssessment({
      cycleId: cycle.id,
      subjectId: subject.id,
      reviewerId: input.reviewerId,
      mode: input.mode,
    }),
    input.mode === "self"
      ? findSubmittedSupervisorReview(cycle.id, subject.id)
      : findSubmittedSelfAssessment(cycle.id, subject.id),
  ]);

  return {
    mode: input.mode,
    cycle: toCycleSummary(cycle),
    subject: {
      id: subject.id,
      name: subject.name,
      nickname: subject.nickname,
      position: subject.position?.name ?? null,
      jobRole: subject.jobRole.name,
      level: subject.jobRole.level,
    },
    competencies,
    scores: mine ? Object.fromEntries(mine.scores) : {},
    submittedAt: mine?.submittedAt?.toISOString() ?? null,
    counterpart: counterpart
      ? {
          scores: Object.fromEntries(counterpart.scores),
          submittedAt: counterpart.submittedAt.toISOString(),
        }
      : null,
  };
}

/* --------------------------------------------------------------- the hub */

export type HubProgress = {
  status: AssessmentStatus;
  /** competencies rated */
  answered: number;
  /** competencies this person's career role is assessed on */
  required: number;
  submittedAt: string | null;
};

export type HubReport = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  level: string;
} & HubProgress;

export type HubResultRow = {
  competencyId: string;
  nameEn: string;
  nameTh: string | null;
  group: CompetencyGroup;
  expected: number;
  score: number;
  gap: number;
  verdict: GapVerdict;
};

export type HubResult = {
  submittedAt: string;
  rows: HubResultRow[];
  counts: Record<GapVerdict, number>;
  /** the parts of the weighted total, already scored on the server */
  parts: { key: "core" | "functional" | "managerial"; score: number | null }[];
};

export type HubData = {
  cycle: CycleSummary | null;
  /** the competency groups the viewer's own role is assessed on */
  groups: CompetencyGroup[];
  self: HubProgress & { competencyCount: number };
  reports: HubReport[];
  result: HubResult | null;
};

const EMPTY_PROGRESS: HubProgress = {
  status: "not-started",
  answered: 0,
  required: 0,
  submittedAt: null,
};

/**
 * The hub in a fixed number of queries no matter how many direct reports the
 * viewer has: the people, their career roles' assessed competencies, every
 * and every relevant assessment with its scores, each read in bulk.
 */
export async function getHubData(input: {
  employeeId: string;
  /** direct report ids — empty when the viewer may not review anybody */
  reportIds: string[];
}): Promise<HubData> {
  const cycle = await getActiveCycle();
  if (!cycle) {
    return {
      cycle: null,
      groups: [],
      self: { ...EMPTY_PROGRESS, competencyCount: 0 },
      reports: [],
      result: null,
    };
  }

  const me = input.employeeId;
  const everyone = [me, ...input.reportIds.filter((id) => id !== me)];

  const [people, myCompetencies, assessments] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: everyone } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nickname: true,
        jobRoleId: true,
        position: { select: { name: true } },
        jobRole: { select: { name: true, level: true } },
      },
    }),
    getCompetencyQuestions(me),
    db.assessment.findMany({
      where: {
        cycleId: cycle.id,
        subjectId: { in: everyone },
        OR: [
          { mode: "SELF", subjectId: me },
          { mode: "SUPERVISOR", reviewerId: me },
          { mode: "SUPERVISOR", subjectId: me },
        ],
      },
      select: {
        subjectId: true,
        reviewerId: true,
        mode: true,
        submittedAt: true,
        scores: { select: { competencyId: true, score: true } },
      },
    }),
  ]);

  const assessedByRole = await getAssessedIdsByJobRole([
    ...new Set(people.map((p) => p.jobRoleId)),
  ]);

  /** How much of an assessment is done, counting only what actually applies. */
  const progressOf = (
    jobRoleId: string,
    row:
      | {
          submittedAt: Date | null;
          scores: { competencyId: string; score: number }[];
        }
      | undefined,
  ): HubProgress => {
    const assessed = assessedByRole.get(jobRoleId) ?? new Set<string>();
    const rated = (row?.scores ?? []).filter((s) =>
      assessed.has(s.competencyId),
    ).length;
    return {
      status: statusOf(row ? { submittedAt: row.submittedAt, answered: rated } : null),
      answered: rated,
      required: assessed.size,
      submittedAt: row?.submittedAt?.toISOString() ?? null,
    };
  };

  const byId = new Map(people.map((p) => [p.id, p]));
  const mine = byId.get(me);

  const selfRow = assessments.find((a) => a.mode === "SELF" && a.subjectId === me);
  const self = {
    ...progressOf(mine?.jobRoleId ?? "", selfRow),
    competencyCount: myCompetencies.length,
  };

  const reports: HubReport[] = input.reportIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const row = assessments.find(
        (a) =>
          a.mode === "SUPERVISOR" && a.subjectId === p.id && a.reviewerId === me,
      );
      return {
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        position: p.position?.name ?? null,
        jobRole: p.jobRole.name,
        level: p.jobRole.level,
        ...progressOf(p.jobRoleId, row),
      };
    });

  /* ------------------------------------------------------- my own result */

  const review = assessments.find(
    (a) => a.mode === "SUPERVISOR" && a.subjectId === me && a.submittedAt !== null,
  );

  let result: HubResult | null = null;
  if (review?.submittedAt) {
    const scores = new Map(review.scores.map((s) => [s.competencyId, s.score]));
    const counts: Record<GapVerdict, number> = {
      strength: 0,
      standard: 0,
      development: 0,
      critical: 0,
    };
    const rows: HubResultRow[] = [];
    for (const c of myCompetencies) {
      const score = scores.get(c.id);
      if (score === undefined) continue;
      const gap = score - c.expected;
      const verdict = verdictFor(gap);
      counts[verdict] += 1;
      rows.push({
        competencyId: c.id,
        nameEn: c.nameEn,
        nameTh: c.nameTh,
        group: c.group,
        expected: c.expected,
        score,
        gap,
        verdict,
      });
    }

    const groupScore = (group: CompetencyGroup) => {
      const rated = myCompetencies
        .filter((c) => c.group === group)
        .map((c) => scores.get(c.id))
        .filter((s): s is number => s !== undefined);
      if (!rated.length) return null;
      return Number(
        (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2),
      );
    };

    result = {
      submittedAt: review.submittedAt.toISOString(),
      rows,
      counts,
      parts: [
        { key: "core", score: groupScore("CORE") },
        { key: "functional", score: groupScore("FUNCTIONAL") },
        { key: "managerial", score: groupScore("MANAGERIAL") },
      ],
    };
  }

  const groups = (["CORE", "FUNCTIONAL", "MANAGERIAL"] as CompetencyGroup[]).filter(
    (g) => myCompetencies.some((c) => c.group === g),
  );

  return { cycle: toCycleSummary(cycle), groups, self, reports, result };
}
