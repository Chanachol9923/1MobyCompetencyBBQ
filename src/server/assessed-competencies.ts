import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Which competencies a person is assessed on, and at what expected level.
 *
 * This is the one place that answers it. Every screen and job that needs the
 * answer — the assessment wizard and hub, gap rows, the admin workforce and
 * matrix, reports, the team heat map, course assignment, IDP gap checks —
 * goes through `assessedSetOf` / `getAssessedSets`, so none of them can
 * disagree about what someone is measured on.
 *
 * The rules:
 *   - CORE and MANAGERIAL: decided by career role alone. The role's
 *     `ExpectedLevel` row gives the level; a null level, or no row, means the
 *     role is not assessed on it.
 *   - FUNCTIONAL: decided by job position first (handoff task 8). A position
 *     with rows in `PositionCompetency` is assessed on exactly those; a
 *     position without rows — and a person without a position — uses the
 *     default set (`Competency.defaultFunctional`: the five original ones).
 *     The level still comes from the career role's `ExpectedLevel`: a null
 *     there means the role is not assessed on it even if the position lists
 *     it (C Suite is assessed on nothing). A role with no row at all for a
 *     functional competency — one created after the role — gets
 *     `DEFAULT_FUNCTIONAL_EXPECTED`, provided the role is assessed on some
 *     functional competency; the administrator can change it in the matrix.
 *
 * Until migration 0017 has run there is no `PositionCompetency` and no
 * `defaultFunctional`: then every functional competency is in everybody's
 * set and a missing row means not assessed — exactly the behaviour from
 * before positions mattered.
 */

export type Group = "CORE" | "FUNCTIONAL" | "MANAGERIAL";

/** competencyId → expected level (1-4) */
export type AssessedSet = Map<string, number>;

/** The expected level a role gets for a functional competency it has no row for. */
export const DEFAULT_FUNCTIONAL_EXPECTED = 3;

export type AssessmentRules = {
  /** migration 0017 has run: positions can carry their own functional set */
  ready: boolean;
  competencies: { id: string; group: Group; sortOrder: number; defaultFunctional: boolean }[];
  /** jobRoleId → competencyId → level; null = deliberately not assessed */
  expected: Map<string, Map<string, number | null>>;
  /** positionId → that position's own functional set (only positions that have one) */
  positionSets: Map<string, Set<string>>;
};

export type AssessablePerson = { jobRoleId: string; positionId: string | null };

/**
 * Whether the 0017 objects exist, asked once rather than per query; an
 * absence is re-checked after a minute so the migration is picked up.
 */
let readySeen: { ready: boolean; at: number } | null = null;
export async function functionalSetsReady(): Promise<boolean> {
  if (readySeen && (readySeen.ready || Date.now() - readySeen.at < 60_000)) {
    return readySeen.ready;
  }
  const rows = await db.$queryRaw<{ ready: boolean }[]>`
    SELECT to_regclass('public."PositionCompetency"') IS NOT NULL AS "ready"`;
  readySeen = { ready: Boolean(rows[0]?.ready), at: Date.now() };
  return readySeen.ready;
}

/**
 * The whole rule book: every competency, every role's expected levels and
 * every position's own functional set. The framework is a few dozen rows, so
 * it is read whole rather than filtered — and never cached across a request,
 * because an admin action re-reads it right after changing it.
 */
export async function loadAssessmentRules(): Promise<AssessmentRules> {
  const ready = await functionalSetsReady();
  const [competencies, expected, links] = await Promise.all([
    ready
      ? db.competency.findMany({
          select: { id: true, group: true, sortOrder: true, defaultFunctional: true },
        })
      : db.competency
          .findMany({ select: { id: true, group: true, sortOrder: true } })
          // before 0017 every functional competency is in everybody's set
          .then((rows) => rows.map((c) => ({ ...c, defaultFunctional: c.group === "FUNCTIONAL" }))),
    db.expectedLevel.findMany({ select: { jobRoleId: true, competencyId: true, level: true } }),
    ready
      ? db.positionCompetency.findMany({ select: { positionId: true, competencyId: true } })
      : Promise.resolve([] as { positionId: string; competencyId: string }[]),
  ]);

  const byRole = new Map<string, Map<string, number | null>>();
  for (const e of expected) {
    let m = byRole.get(e.jobRoleId);
    if (!m) byRole.set(e.jobRoleId, (m = new Map()));
    m.set(e.competencyId, e.level);
  }
  const functional = new Set(competencies.filter((c) => c.group === "FUNCTIONAL").map((c) => c.id));
  const positionSets = new Map<string, Set<string>>();
  for (const l of links) {
    // the 0017 trigger allows functional only; ignore anything else regardless
    if (!functional.has(l.competencyId)) continue;
    let s = positionSets.get(l.positionId);
    if (!s) positionSets.set(l.positionId, (s = new Set()));
    s.add(l.competencyId);
  }
  return {
    ready,
    competencies: [...competencies].sort((a, b) => a.sortOrder - b.sortOrder),
    expected: byRole,
    positionSets,
  };
}

/** The functional competencies a position is assessed on: its own set, or the default. */
export function functionalSetOf(rules: AssessmentRules, positionId: string | null): Set<string> {
  const own = positionId ? rules.positionSets.get(positionId) : undefined;
  if (own) return own;
  return new Set(rules.competencies.filter((c) => c.group === "FUNCTIONAL" && c.defaultFunctional).map((c) => c.id));
}

/** Whether this role is assessed on any functional competency at all. */
function roleHasFunctional(rules: AssessmentRules, jobRoleId: string): boolean {
  const levels = rules.expected.get(jobRoleId);
  if (!levels) return false;
  return rules.competencies.some((c) => c.group === "FUNCTIONAL" && (levels.get(c.id) ?? null) !== null);
}

/**
 * The level a career role expects on a competency, as the rules apply it:
 * the stored level, or for a functional competency the role has no row for,
 * the default (when the role is assessed on functional competencies at all).
 * Position is not considered — this is the matrix cell.
 */
export function expectedCell(rules: AssessmentRules, jobRoleId: string, competencyId: string): number | null {
  const row = rules.expected.get(jobRoleId)?.get(competencyId);
  if (row !== undefined) return row;
  const c = rules.competencies.find((x) => x.id === competencyId);
  if (rules.ready && c?.group === "FUNCTIONAL" && roleHasFunctional(rules, jobRoleId)) {
    return DEFAULT_FUNCTIONAL_EXPECTED;
  }
  return null;
}

/** THE answer: what this person is assessed on, at what expected level, in framework order. */
export function assessedSetOf(rules: AssessmentRules, person: AssessablePerson): AssessedSet {
  const out: AssessedSet = new Map();
  const functional = functionalSetOf(rules, person.positionId);
  for (const c of rules.competencies) {
    if (c.group === "FUNCTIONAL" && !functional.has(c.id)) continue;
    const level = expectedCell(rules, person.jobRoleId, c.id);
    if (level !== null) out.set(c.id, level);
  }
  return out;
}

/** The same for many people at once, by employee id, from one read of the rules. */
export async function getAssessedSets(
  people: ({ id: string } & AssessablePerson)[],
  rules?: AssessmentRules,
): Promise<Map<string, AssessedSet>> {
  const r = rules ?? (await loadAssessmentRules());
  return new Map(people.map((p) => [p.id, assessedSetOf(r, p)]));
}

/**
 * The rules once per request, for the read paths that ask person by person
 * (a team page builds several gap reports). Code that changes the rules and
 * then acts on them (the matrix, position sets, course assignment) calls
 * `loadAssessmentRules` directly, never this.
 */
const rulesForRender = cache(loadAssessmentRules);

/** One person by id; an empty set when the person does not exist. */
export async function getAssessedSet(employeeId: string): Promise<AssessedSet> {
  const [person, rules] = await Promise.all([
    db.employee.findUnique({ where: { id: employeeId }, select: { jobRoleId: true, positionId: true } }),
    rulesForRender(),
  ]);
  return person ? assessedSetOf(rules, person) : new Map();
}
