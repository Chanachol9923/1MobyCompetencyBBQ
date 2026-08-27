/**
 * Shared logic for the 180° assessment system (Self / Supervisor).
 *
 * Everything here is pure so the wizard, the hub and the result page all agree
 * on which steps exist, which competencies are actually assessed for a role and
 * how the weighted total is produced.
 */

import {
  COMPETENCIES,
  expectedFor,
  isAssessed,
  verdictFor,
  type Competency,
  type GapVerdict,
  type Group,
} from "@/data/competencies";
import { FRAMEWORK } from "@/data/framework";
import type { Person } from "@/data/people";
import type {
  AssessmentState,
  DemoState,
  KpiItem,
  Weights,
} from "@/lib/store";
import { currentCycle } from "@/data/cycle";

/* ------------------------------------------------------------------- cycle */

/**
 * One open cycle, derived from today in `@/data/cycle` so the wizard, the admin
 * console and the IDP timeline can never disagree about which quarter it is.
 */
export const CYCLE = currentCycle();

/* -------------------------------------------------------------------- mode */

export type Mode = "self" | "supervisor";

export const MODES: Mode[] = ["self", "supervisor"];

export const isMode = (v: string): v is Mode =>
  v === "self" || v === "supervisor";

/** i18n key in DICT for the mode name. */
export const MODE_KEY: Record<Mode, string> = {
  self: "mode.self",
  supervisor: "mode.supervisor",
};

/* ------------------------------------------------------------------- steps */

export type StepKey = "kpi" | Group | "complete";

export const GROUP_STEP_KEY: Record<Group, string> = {
  core: "group.core",
  functional: "group.functional",
  managerial: "group.managerial",
};

/** DICT key for a step label. */
export function stepKeyOf(step: StepKey): string {
  if (step === "kpi") return "group.kpi";
  if (step === "complete") return "label.complete";
  return GROUP_STEP_KEY[step];
}

/** Competencies of a group that this specific job role is assessed on. */
export function competenciesFor(jobRole: string, group: Group): Competency[] {
  return COMPETENCIES.filter(
    (c) => c.group === group && isAssessed(jobRole, c.id),
  );
}

/** Every competency this job role is assessed on, in framework order. */
export function allCompetenciesFor(jobRole: string): Competency[] {
  return COMPETENCIES.filter((c) => isAssessed(jobRole, c.id));
}

/**
 * Steps are derived from the *target* person's job role. An Executive has no
 * Managerial step at all because none of the four managerial competencies are
 * assessed for that role.
 */
export function stepsFor(jobRole: string): StepKey[] {
  const groups: Group[] = (["core", "functional", "managerial"] as Group[]).filter(
    (g) => competenciesFor(jobRole, g).length > 0,
  );
  return ["kpi", ...groups, "complete"];
}

/* ------------------------------------------------------------------ levels */

export type MergedLevel = {
  score: number;
  labelEn: string;
  labelTh: string;
  descTh: string;
  behaviorTh: string;
};

/**
 * The generated framework occasionally holds two rows for the same score
 * (the workbook had merged cells). Fold them into one entry per score so the
 * rating scale always renders exactly four boxes.
 */
const LEVEL_CACHE = new Map<string, MergedLevel[]>();

/** the workbook export escaped its newlines - turn "\n" back into a real break */
const unescape = (s: string) =>
  (s ?? "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();

export function levelsFor(competencyId: string): MergedLevel[] {
  const cached = LEVEL_CACHE.get(competencyId);
  if (cached) return cached;
  const source = FRAMEWORK.find((f) => f.id === competencyId)?.levels ?? [];
  const merged: MergedLevel[] = [1, 2, 3, 4].map((score) => {
    const rows = source.filter((l) => l.score === score);
    return {
      score,
      labelEn: rows[0]?.labelEn ?? "",
      labelTh: rows[0]?.labelTh ?? "",
      descTh: rows
        .map((r) => unescape(r.descTh))
        .filter(Boolean)
        .join("\n"),
      behaviorTh: rows
        .map((r) => unescape(r.behaviorTh))
        .filter(Boolean)
        .join("\n"),
    };
  });
  LEVEL_CACHE.set(competencyId, merged);
  return merged;
}

/** The Thai sub-competency headline ("High-Impact & Measurable Outcome- ..."). */
export function subTitleTh(competencyId: string): string {
  return FRAMEWORK.find((f) => f.id === competencyId)?.subTh ?? "";
}

const EXAMPLE_MARK = "ตัวอย่าง:";

/**
 * The workbook export escaped its newlines, so behaviour text arrives as a
 * literal backslash-n. Normalise, split the bullet list off the worked example.
 */
export function parseBehavior(raw: string): {
  bullets: string[];
  example: string;
} {
  const text = unescape(raw);
  const at = text.indexOf(EXAMPLE_MARK);
  const head = at >= 0 ? text.slice(0, at) : text;
  const example = at >= 0 ? text.slice(at + EXAMPLE_MARK.length).trim() : "";
  const bullets = head
    .split("\n")
    .map((line) => line.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
  return { bullets, example };
}

/**
 * English has no per-level copy in the client workbook. These are faithful
 * renderings of LEVEL_LABEL_TH so an English reader sees the same scale.
 */
export const LEVEL_DESC_EN: Record<number, string> = {
  4: "Does this consistently and sets the example for everyone else.",
  3: "Does this well and consistently, as the role requires.",
  2: "Does this some of the time — still building consistency.",
  1: "Does not yet show this behaviour, or acts against it.",
};

/* ------------------------------------------------------------------ records */

export const reviewKey = (reviewerId: string, targetId: string) =>
  `${reviewerId}:${targetId}`;

export const EMPTY_RECORD: AssessmentState = { answers: {}, submittedAt: null };

export function getRecord(
  state: DemoState,
  mode: Mode,
  reviewerId: string,
  targetId: string,
): AssessmentState | undefined {
  if (mode === "self") return state.selfAssessment[targetId];
  return state.managerReview[reviewKey(reviewerId, targetId)];
}

/** Immutable update of the right bucket for a mode. */
export function withRecord(
  s: DemoState,
  mode: Mode,
  reviewerId: string,
  targetId: string,
  fn: (prev: AssessmentState) => AssessmentState,
): DemoState {
  if (mode === "self") {
    const prev = s.selfAssessment[targetId] ?? EMPTY_RECORD;
    return {
      ...s,
      selfAssessment: { ...s.selfAssessment, [targetId]: fn(prev) },
    };
  }
  const key = reviewKey(reviewerId, targetId);
  const prev = s.managerReview[key] ?? EMPTY_RECORD;
  return { ...s, managerReview: { ...s.managerReview, [key]: fn(prev) } };
}

/* --------------------------------------------------------------------- KPI */

export const kpiKey = (kpiItemId: string) => `kpi:${kpiItemId}`;

export function kpiItemsFor(state: DemoState, personId: string): KpiItem[] {
  return state.kpi[personId] ?? [];
}

/** Weighted 1–4 KPI score. Null until at least one KPI is rated. */
export function kpiScore(
  items: KpiItem[],
  answers: Record<string, number>,
): number | null {
  let sum = 0;
  let used = 0;
  items.forEach((i) => {
    const s = answers[kpiKey(i.id)];
    if (s) {
      sum += s * i.weight;
      used += i.weight;
    }
  });
  return used ? Number((sum / used).toFixed(2)) : null;
}

export function kpiWeightTotal(items: KpiItem[]): number {
  return items.reduce((a, i) => a + i.weight, 0);
}

/* ------------------------------------------------------------------ scores */

export function groupScore(
  jobRole: string,
  group: Group,
  answers: Record<string, number>,
): number | null {
  const rated = competenciesFor(jobRole, group).filter((c) => answers[c.id]);
  if (!rated.length) return null;
  return Number(
    (rated.reduce((a, c) => a + (answers[c.id] ?? 0), 0) / rated.length).toFixed(
      2,
    ),
  );
}

export type WeightRow = {
  key: "kpi" | Group;
  /** the configured weight from state.weights */
  weight: number;
  /** weight after removing parts this role has no score for */
  effWeight: number;
  score: number | null;
};

export type WeightedResult = {
  rows: WeightRow[];
  /** 1–4 */
  total: number | null;
  /** 0–100 */
  percent: number | null;
};

/**
 * Weighted total = Σ (part score × part weight). Parts a role is not assessed
 * on (Managerial for an Executive) drop out and their weight is redistributed
 * proportionally across the parts that remain, so the total is always out of 4.
 */
export function weightedTotal(
  jobRole: string,
  answers: Record<string, number>,
  kpiItems: KpiItem[],
  weights: Weights,
): WeightedResult {
  const raw: { key: "kpi" | Group; weight: number; score: number | null }[] = [
    { key: "kpi", weight: weights.kpi, score: kpiScore(kpiItems, answers) },
    { key: "core", weight: weights.core, score: groupScore(jobRole, "core", answers) },
    {
      key: "functional",
      weight: weights.functional,
      score: groupScore(jobRole, "functional", answers),
    },
    {
      key: "managerial",
      weight: weights.managerial,
      score: groupScore(jobRole, "managerial", answers),
    },
  ];

  // managerial disappears entirely for roles that are not assessed on it
  const applicable = raw.filter(
    (r) =>
      r.key === "kpi" ||
      competenciesFor(jobRole, r.key as Group).length > 0,
  );

  const scored = applicable.filter((r) => r.score !== null);
  const denom = scored.reduce((a, r) => a + r.weight, 0);

  const rows: WeightRow[] = applicable.map((r) => ({
    ...r,
    effWeight:
      denom && r.score !== null
        ? Number(((r.weight / denom) * 100).toFixed(1))
        : 0,
  }));

  if (!denom) return { rows, total: null, percent: null };

  const total = Number(
    rows
      .reduce((a, r) => a + (r.score ?? 0) * (r.effWeight / 100), 0)
      .toFixed(2),
  );
  return { rows, total, percent: Number(((total / 4) * 100).toFixed(1)) };
}

/* ------------------------------------------------------------------- gaps */

export type GapRow = {
  competency: Competency;
  score: number | null;
  expected: number | null;
  gap: number | null;
  verdict: GapVerdict | null;
};

export function gapRows(
  jobRole: string,
  answers: Record<string, number>,
): GapRow[] {
  return allCompetenciesFor(jobRole).map((competency) => {
    const score = answers[competency.id] ?? null;
    const expected = expectedFor(jobRole, competency.id);
    const gap =
      score !== null && expected !== null ? score - expected : null;
    return {
      competency,
      score,
      expected,
      gap,
      verdict: gap === null ? null : verdictFor(gap),
    };
  });
}

export function verdictCounts(rows: GapRow[]): Record<GapVerdict, number> {
  const counts: Record<GapVerdict, number> = {
    strength: 0,
    standard: 0,
    development: 0,
    critical: 0,
  };
  rows.forEach((r) => {
    if (r.verdict) counts[r.verdict] += 1;
  });
  return counts;
}

/* ---------------------------------------------------------------- progress */

export type Status = "not-started" | "in-progress" | "submitted";

export function requiredCount(jobRole: string, kpiItems: KpiItem[]): number {
  return allCompetenciesFor(jobRole).length + kpiItems.length;
}

export function answeredCount(
  jobRole: string,
  kpiItems: KpiItem[],
  record: AssessmentState | undefined,
): number {
  const a = record?.answers ?? {};
  const comps = allCompetenciesFor(jobRole).filter((c) => a[c.id]).length;
  const kpis = kpiItems.filter((i) => a[kpiKey(i.id)]).length;
  return comps + kpis;
}

export function statusOf(record: AssessmentState | undefined): Status {
  if (!record) return "not-started";
  if (record.submittedAt) return "submitted";
  return Object.keys(record.answers).length ? "in-progress" : "not-started";
}

export const STATUS_KEY: Record<Status, string> = {
  "not-started": "status.notStarted",
  "in-progress": "status.inProgress",
  submitted: "status.submitted",
};

/* ------------------------------------------------- the official supervisor */

export type ManagerAnswers = {
  answers: Record<string, number>;
  /** "review" = a supervisor submitted it in this demo session */
  source: "review" | "seed";
  submittedAt: string | null;
};

/**
 * The supervisor view of a person: a submitted manager review if one exists,
 * otherwise the seeded managerScores from the client workbook.
 */
export function managerAnswersFor(
  state: DemoState,
  target: Person,
): ManagerAnswers | null {
  const direct = state.managerReview[reviewKey(target.reportTo, target.id)];
  if (direct?.submittedAt) {
    return {
      answers: direct.answers,
      source: "review",
      submittedAt: direct.submittedAt,
    };
  }
  const suffix = `:${target.id}`;
  const any = Object.entries(state.managerReview).find(
    ([k, v]) => k.endsWith(suffix) && v.submittedAt,
  );
  if (any) {
    return {
      answers: any[1].answers,
      source: "review",
      submittedAt: any[1].submittedAt,
    };
  }
  if (Object.keys(target.managerScores).length) {
    return { answers: target.managerScores, source: "seed", submittedAt: null };
  }
  return null;
}

/* ---------------------------------------------------------------- routing */

export const runHref = (mode: Mode, targetId: string) =>
  `/assessment/${mode}/${targetId}`;

/* --------------------------------------------------------------- format */

export function formatDateTime(iso: string, lang: "en" | "th") {
  try {
    return new Date(iso).toLocaleString(lang === "th" ? "th-TH" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
