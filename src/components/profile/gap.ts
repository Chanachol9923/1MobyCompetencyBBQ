/**
 * Gap analysis helpers shared by Dashboard, Team Profile and Reports.
 *
 * Everything here follows the client's definition from the phase-2 brief:
 *   gap = manager score - expected level (expectedFor(jobRole, competencyId))
 * and a competency is simply absent when `isAssessed(jobRole, id)` is false —
 * never rendered as a zero, never rendered as a radar spoke.
 */

import {
  COMPETENCIES,
  assessedFor,
  expectedFor,
  isAssessed,
  verdictFor,
  type Competency,
  type GapVerdict,
  type Group,
} from "@/data/competencies";
import type { Person } from "@/data/people";
import type { DemoState } from "@/lib/store";
import type { RadarDatum } from "@/components/charts";

const round2 = (n: number) => Number(n.toFixed(2));

/* ------------------------------------------------------------- raw scores */

/**
 * The official score is the manager assessment. A submitted manager review in
 * the store wins over the seeded workbook value.
 */
export function managerScoreFor(
  state: DemoState,
  person: Person,
  competencyId: string,
): number {
  for (const key of Object.keys(state.managerReview)) {
    if (!key.endsWith(`:${person.id}`)) continue;
    const review = state.managerReview[key];
    if (review?.submittedAt && review.answers[competencyId] != null) {
      return review.answers[competencyId]!;
    }
  }
  return person.managerScores[competencyId] ?? person.scores[competencyId] ?? 0;
}

/** The employee's own view — the other half of the 180° model. */
export function selfScoreFor(
  state: DemoState,
  person: Person,
  competencyId: string,
): number {
  const self = state.selfAssessment[person.id];
  if (self?.submittedAt && self.answers[competencyId] != null) {
    return self.answers[competencyId]!;
  }
  return (
    person.selfScores[competencyId] ??
    person.managerScores[competencyId] ??
    0
  );
}

/* --------------------------------------------------------------- one person */

export type GapRow = {
  competency: Competency;
  /** self assessment */
  self: number;
  /** manager assessment — the official score */
  manager: number;
  expected: number;
  gap: number;
  /** manager − self; positive means the manager rates them higher */
  delta: number;
  verdict: GapVerdict;
};

/** Competencies this person is actually assessed on, optionally one group. */
export function assessedCompetencies(person: Person, group?: Group) {
  return assessedFor(person.jobRole, group);
}

/** Does this person have any competency in the group at all? */
export function hasGroup(person: Person, group: Group) {
  return assessedFor(person.jobRole, group).length > 0;
}

/** The groups a person is assessed on, in display order. */
export const GROUP_ORDER: Group[] = ["core", "functional", "managerial"];

export function groupsFor(person: Person): Group[] {
  return GROUP_ORDER.filter((g) => hasGroup(person, g));
}

export function gapRows(
  state: DemoState,
  person: Person,
  group?: Group,
): GapRow[] {
  return assessedCompetencies(person, group).map((c) => {
    const expected = expectedFor(person.jobRole, c.id) ?? 3;
    const manager = managerScoreFor(state, person, c.id);
    const self = selfScoreFor(state, person, c.id);
    const gap = round2(manager - expected);
    return {
      competency: c,
      self,
      manager,
      expected,
      gap,
      delta: round2(manager - self),
      verdict: verdictFor(gap),
    };
  });
}

/** Radar spokes — expectation vs the official (manager) score. */
export function radarRowsFor(
  state: DemoState,
  person: Person,
  group: Group,
): RadarDatum[] {
  return gapRows(state, person, group).map((r) => ({
    skill: r.competency.name,
    expectation: r.expected,
    actual: r.manager,
  }));
}

/** Average official score across everything the person is assessed on. */
export function overallFor(state: DemoState, person: Person) {
  const rows = gapRows(state, person);
  if (!rows.length) return 0;
  return round2(rows.reduce((a, r) => a + r.manager, 0) / rows.length);
}

/** Average expected level across everything the person is assessed on. */
export function expectedAverageFor(state: DemoState, person: Person) {
  const rows = gapRows(state, person);
  if (!rows.length) return 0;
  return round2(rows.reduce((a, r) => a + r.expected, 0) / rows.length);
}

/** Heat map cell value: `null` when the person is not assessed on it. */
export function heatValue(
  state: DemoState,
  person: Person,
  competencyId: string,
): number | null {
  if (!isAssessed(person.jobRole, competencyId)) return null;
  return managerScoreFor(state, person, competencyId);
}

/* ------------------------------------------------------------ many people */

export type AggRow = {
  competency: Competency;
  avgManager: number;
  avgSelf: number;
  avgExpected: number;
  gap: number;
  verdict: GapVerdict;
  /** how many people in scope are assessed on this competency */
  assessedCount: number;
  /** how many of those sit below their own expected level */
  belowCount: number;
  /** the highest scorer in scope, for the "who is good at what" read */
  topPerson: Person | null;
  topScore: number;
};

/** Per-competency roll-up over a set of people, skipping unassessed pairs. */
export function aggregateGaps(state: DemoState, people: Person[]): AggRow[] {
  const rows: AggRow[] = [];
  COMPETENCIES.forEach((c) => {
    const subjects = people.filter((p) => isAssessed(p.jobRole, c.id));
    if (!subjects.length) return;
    let mgr = 0;
    let self = 0;
    let exp = 0;
    let below = 0;
    let topPerson: Person | null = null;
    let topScore = -1;
    subjects.forEach((p) => {
      const m = managerScoreFor(state, p, c.id);
      const e = expectedFor(p.jobRole, c.id) ?? 3;
      mgr += m;
      self += selfScoreFor(state, p, c.id);
      exp += e;
      if (m < e) below += 1;
      if (m > topScore) {
        topScore = m;
        topPerson = p;
      }
    });
    const n = subjects.length;
    const avgManager = round2(mgr / n);
    const avgExpected = round2(exp / n);
    const gap = round2(avgManager - avgExpected);
    rows.push({
      competency: c,
      avgManager,
      avgSelf: round2(self / n),
      avgExpected,
      gap,
      verdict: verdictFor(gap),
      assessedCount: n,
      belowCount: below,
      topPerson,
      topScore: topScore < 0 ? 0 : topScore,
    });
  });
  return rows;
}

export type VerdictCounts = Record<GapVerdict, number>;

export function verdictCounts(rows: { verdict: GapVerdict }[]): VerdictCounts {
  const counts: VerdictCounts = {
    strength: 0,
    standard: 0,
    development: 0,
    critical: 0,
  };
  rows.forEach((r) => (counts[r.verdict] += 1));
  return counts;
}

export type PersonSummary = {
  person: Person;
  avgGap: number;
  criticalCount: number;
  best: GapRow | null;
  worst: GapRow | null;
};

/** Per-person roll-up used by the "who is good at what" panel. */
export function personSummaries(
  state: DemoState,
  people: Person[],
): PersonSummary[] {
  return people.map((person) => {
    const rows = gapRows(state, person);
    const sorted = [...rows].sort((a, b) => b.gap - a.gap);
    return {
      person,
      avgGap: rows.length
        ? round2(rows.reduce((a, r) => a + r.gap, 0) / rows.length)
        : 0,
      criticalCount: rows.filter((r) => r.verdict === "critical").length,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
    };
  });
}

/** "+0.5" / "0" / "-1.25" — signed, trimmed. */
export function formatGap(gap: number) {
  const rounded = round2(gap);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export { round2 };
