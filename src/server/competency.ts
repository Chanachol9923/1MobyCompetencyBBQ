import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getAssessedSet } from "@/server/assessed-competencies";

/**
 * The gap engine, reading from Postgres.
 *
 * Two rules from the client's framework are enforced here so no screen can get
 * them wrong:
 *   1. a competency outside the person's assessed set (career role, and job
 *      position for functional ones — `assessed-competencies.ts`) is NOT
 *      assessed and must be absent, never rendered as a zero;
 *   2. gap = supervisor score − expected level, and the verdict wording is the
 *      client's own.
 */

export type GapVerdict = "strength" | "standard" | "development" | "critical";

export const VERDICT_LABEL: Record<GapVerdict, { en: string; th: string }> = {
  strength: { en: "Strength", th: "จุดแข็ง" },
  standard: { en: "Competency Fit", th: "ตรงตามมาตรฐาน" },
  development: { en: "Development", th: "ควรพัฒนา" },
  critical: { en: "Critical", th: "ต้องพัฒนาเร่งด่วน" },
};

export function verdictFor(gap: number): GapVerdict {
  if (gap > 0) return "strength";
  if (gap === 0) return "standard";
  if (gap > -1) return "development";
  return "critical";
}

export type GapRow = {
  competencyId: string;
  key: string;
  group: "CORE" | "FUNCTIONAL" | "MANAGERIAL";
  nameEn: string;
  definitionEn: string | null;
  definitionTh: string | null;
  expected: number;
  self: number | null;
  manager: number | null;
  /** manager score when it exists, otherwise the self score */
  score: number | null;
  gap: number;
  verdict: GapVerdict;
};

/** The open cycle, or the most recent one if nothing is open. */
export const getActiveCycle = cache(async () => {
  return (
    (await db.assessmentCycle.findFirst({
      where: { status: "OPEN" },
      orderBy: { startsAt: "desc" },
    })) ??
    (await db.assessmentCycle.findFirst({ orderBy: { startsAt: "desc" } }))
  );
});

/**
 * Every competency this person is assessed on, with their scores. One query
 * per source rather than one per competency.
 */
export const getGapRows = cache(async (employeeId: string): Promise<GapRow[]> => {
  const cycle = await getActiveCycle();
  if (!cycle) return [];

  // the assessed set and the person's scores are independent reads
  const [assessed, assessments] = await Promise.all([
    getAssessedSet(employeeId),
    db.assessment.findMany({
      where: { cycleId: cycle.id, subjectId: employeeId },
      select: {
        mode: true,
        submittedAt: true,
        scores: { select: { competencyId: true, score: true } },
      },
    }),
  ]);
  if (assessed.size === 0) return [];
  const competencies = await db.competency.findMany({
    where: { id: { in: [...assessed.keys()] } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, group: true, nameEn: true, definitionEn: true, definitionTh: true },
  });

  const selfScores = new Map<string, number>();
  const managerScores = new Map<string, number>();
  for (const a of assessments) {
    const target = a.mode === "SELF" ? selfScores : managerScores;
    for (const s of a.scores) target.set(s.competencyId, s.score);
  }

  // rule 1: only the assessed set becomes rows
  return competencies.map((c) => {
    const expected = assessed.get(c.id)!;
    const self = selfScores.get(c.id) ?? null;
    const manager = managerScores.get(c.id) ?? null;
    const score = manager ?? self;
    const gap = score === null ? 0 : score - expected;
    return {
      competencyId: c.id,
      key: c.key,
      group: c.group,
      nameEn: c.nameEn,
      definitionEn: c.definitionEn,
      definitionTh: c.definitionTh,
      expected,
      self,
      manager,
      score,
      gap,
      verdict: verdictFor(gap),
    };
  });
});

export type PersonSummary = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  employeeCode: string;
  jobRole: string;
  level: string;
  department: string | null;
  division: string | null;
  position: string | null;
  managerId: string | null;
  /** average supervisor score across assessed competencies */
  skillIndex: number;
  averageExpected: number;
  gapCounts: Record<GapVerdict, number>;
  /** 0-100, how much of this cycle's assessment is done */
  cycleProgress: number;
};

export async function getPersonSummary(employeeId: string): Promise<PersonSummary | null> {
  const [employee, rows] = await Promise.all([
    db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        employeeCode: true,
        managerId: true,
        jobRole: { select: { name: true, level: true } },
        department: { select: { name: true } },
        division: { select: { name: true } },
        position: { select: { name: true } },
      },
    }),
    getGapRows(employeeId),
  ]);
  if (!employee) return null;

  const scored = rows.filter((r) => r.score !== null);
  const counts: Record<GapVerdict, number> = {
    strength: 0,
    standard: 0,
    development: 0,
    critical: 0,
  };
  for (const r of scored) counts[r.verdict]++;

  const avg = (xs: number[]) =>
    xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : 0;

  return {
    id: employee.id,
    name: employee.name,
    nickname: employee.nickname,
    email: employee.email,
    employeeCode: employee.employeeCode,
    jobRole: employee.jobRole.name,
    level: employee.jobRole.level,
    department: employee.department?.name ?? null,
    division: employee.division?.name ?? null,
    position: employee.position?.name ?? null,
    managerId: employee.managerId,
    skillIndex: avg(scored.map((r) => r.score!)),
    averageExpected: avg(rows.map((r) => r.expected)),
    gapCounts: counts,
    cycleProgress: rows.length
      ? Math.round((scored.length / rows.length) * 100)
      : 0,
  };
}

/** Direct reports of a manager, each with their headline numbers. */
export async function getTeamSummaries(managerId: string): Promise<PersonSummary[]> {
  const reports = await db.employee.findMany({
    where: { managerId, active: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  // every report at once, not one after another
  const summaries = await Promise.all(reports.map((r) => getPersonSummary(r.id)));
  return summaries.filter((s): s is PersonSummary => s !== null);
}

/** Current points balance, summed from the append-only ledger. */
export async function getPointsBalance(employeeId: string): Promise<number> {
  const agg = await db.pointLedger.aggregate({
    where: { employeeId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

/**
 * Ledger rows that move points around rather than earn them: spending points
 * on a reward, and the refund when a redemption is cancelled.
 */
export const SPENDING_REF_TYPES = ["redemption"];

/**
 * The leaderboard ranks points *earned*. Spending them on a reward lowers the
 * balance but must not cost anyone their place, so redemptions (and their
 * refunds) are left out of the sum.
 */
export async function getPointsLeaderboard(limit = 10) {
  const grouped = await db.pointLedger.groupBy({
    by: ["employeeId"],
    where: { OR: [{ refType: null }, { refType: { notIn: SPENDING_REF_TYPES } }] },
    _sum: { delta: true },
    orderBy: { _sum: { delta: "desc" } },
    take: limit,
  });
  const employees = await db.employee.findMany({
    where: { id: { in: grouped.map((g) => g.employeeId) } },
    select: { id: true, name: true, nickname: true, position: { select: { name: true } } },
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  return grouped.map((g, i) => ({
    rank: i + 1,
    employeeId: g.employeeId,
    name: byId.get(g.employeeId)?.name ?? "—",
    position: byId.get(g.employeeId)?.position?.name ?? null,
    points: g._sum.delta ?? 0,
  }));
}
