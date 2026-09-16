/**
 * The client-side half of the 180° assessment.
 *
 * The data lives in Postgres and `src/server/assessment.ts` reads it; this
 * module carries only what a browser bundle needs — the shapes it receives, how
 * the steps are derived from them, and the weighted-total formula the wizard
 * has to recompute on every click without a round trip.
 *
 * Everything here is pure. Nothing reads a database, a store or a session, so
 * the hub (a server component) and the wizard (a client one) can share it and
 * cannot disagree about what a step, a total or a status is.
 */

import type {
  AssessmentStatus,
  CompetencyGroup,
  CompetencyQuestion,
  CycleSummary,
  KpiRow,
  LevelDetail,
  Mode,
} from "@/server/assessment";

// `import type` is erased at compile time, so naming a server-only module
// costs the client bundle nothing.
export type {
  AssessmentStatus,
  CompetencyGroup,
  CompetencyQuestion,
  CycleSummary,
  KpiRow,
  LevelDetail,
  Mode,
};

/* -------------------------------------------------------------------- mode */

export const MODES: Mode[] = ["self", "supervisor"];

export const isMode = (value: string): value is Mode =>
  value === "self" || value === "supervisor";

/** DICT key for the mode name. */
export const MODE_KEY: Record<Mode, string> = {
  self: "mode.self",
  supervisor: "mode.supervisor",
};

/* ------------------------------------------------------------------ groups */

export const GROUP_ORDER: CompetencyGroup[] = [
  "CORE",
  "FUNCTIONAL",
  "MANAGERIAL",
];

/** Reuses the shared vocabulary rather than a second copy of the wording. */
export const groupDictKey = (group: CompetencyGroup) =>
  `group.${group.toLowerCase()}`;

/* ------------------------------------------------------------------- steps */

export type StepKey = "kpi" | CompetencyGroup | "complete";

export function stepDictKey(step: StepKey): string {
  if (step === "kpi") return "group.kpi";
  if (step === "complete") return "label.complete";
  return groupDictKey(step);
}

/**
 * Steps come from the *target's* career role, through the competencies the
 * server already filtered to the ones that role is assessed on. An Executive
 * has no Managerial step at all, because none of the managerial competencies
 * carry an expected level for that role.
 */
export function stepsFor(competencies: { group: CompetencyGroup }[]): StepKey[] {
  const groups = GROUP_ORDER.filter((g) =>
    competencies.some((c) => c.group === g),
  );
  return ["kpi", ...groups, "complete"];
}

/* ------------------------------------------------------------------ levels */

const EXAMPLE_MARK = "ตัวอย่าง:";

/**
 * The Thai behaviour text is a bullet list followed by a `ตัวอย่าง:` worked
 * example. Split the two so the example can sit behind its own disclosure.
 */
export function parseBehavior(raw: string | null): {
  bullets: string[];
  example: string;
} {
  const text = (raw ?? "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();
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
 * The workbook has no English per-level copy — `CompetencyLevel.descEn` is null
 * for every row. These are faithful renderings of the Thai scale so an English
 * reader sees the same four steps rather than four blanks.
 */
export const LEVEL_DESC_EN: Record<number, string> = {
  4: "Does this consistently and sets the example for everyone else.",
  3: "Does this well and consistently, as the role requires.",
  2: "Does this some of the time — still building consistency.",
  1: "Does not yet show this behaviour, or acts against it.",
};

/* --------------------------------------------------------------------- KPI */

export function kpiWeightTotal(items: { weight: number }[]): number {
  return items.reduce((a, i) => a + i.weight, 0);
}

/**
 * Weighted 1–4 KPI score. Null until at least one KPI is rated; the divisor is
 * the weight of the KPIs that *have* been rated, so a half-finished step still
 * reads as a score out of 4 rather than a score dragged toward zero.
 */
export function kpiScore(
  items: KpiRow[],
  scores: Record<string, number | null>,
): number | null {
  let sum = 0;
  let used = 0;
  for (const item of items) {
    const score = scores[item.id] ?? item.score;
    if (!score) continue;
    sum += score * item.weight;
    used += item.weight;
  }
  return used ? Number((sum / used).toFixed(2)) : null;
}

/* ------------------------------------------------------------------ scores */

export type PartKey = "kpi" | "core" | "functional" | "managerial";

export const PART_DICT_KEY: Record<PartKey, string> = {
  kpi: "group.kpi",
  core: "group.core",
  functional: "group.functional",
  managerial: "group.managerial",
};

export type Weights = CycleSummary["weights"];

export type WeightRow = {
  key: PartKey;
  /** the weight HR configured on the cycle */
  weight: number;
  /** that weight after the parts this role has no score for are removed */
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

/** Mean of the competencies of one group that have been rated. */
export function groupScore(
  competencies: { id: string; group: CompetencyGroup }[],
  group: CompetencyGroup,
  scores: Record<string, number | undefined>,
): number | null {
  const rated = competencies
    .filter((c) => c.group === group)
    .map((c) => scores[c.id])
    .filter((s): s is number => Boolean(s));
  if (!rated.length) return null;
  return Number((rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2));
}

/**
 * Weighted total = Σ (part score × part weight), out of 4.
 *
 * A part the career role is not assessed on — Managerial for an Executive —
 * drops out entirely and its weight is shared across the parts that remain in
 * proportion, so the total is always comparable with anybody else's.
 */
export function weightedTotal(input: {
  weights: Weights;
  competencies: { id: string; group: CompetencyGroup }[];
  scores: Record<string, number | undefined>;
  kpis: KpiRow[];
  kpiScores: Record<string, number | null>;
}): WeightedResult {
  const { weights, competencies, scores } = input;

  const raw: { key: PartKey; weight: number; score: number | null }[] = [
    { key: "kpi", weight: weights.kpi, score: kpiScore(input.kpis, input.kpiScores) },
    { key: "core", weight: weights.core, score: groupScore(competencies, "CORE", scores) },
    {
      key: "functional",
      weight: weights.functional,
      score: groupScore(competencies, "FUNCTIONAL", scores),
    },
    {
      key: "managerial",
      weight: weights.managerial,
      score: groupScore(competencies, "MANAGERIAL", scores),
    },
  ];

  const applicable = raw.filter(
    (r) =>
      r.key === "kpi" ||
      competencies.some((c) => c.group === r.key.toUpperCase()),
  );

  const denom = applicable
    .filter((r) => r.score !== null)
    .reduce((a, r) => a + r.weight, 0);

  const rows: WeightRow[] = applicable.map((r) => ({
    ...r,
    effWeight:
      denom && r.score !== null
        ? Number(((r.weight / denom) * 100).toFixed(1))
        : 0,
  }));

  if (!denom) return { rows, total: null, percent: null };

  const total = Number(
    rows.reduce((a, r) => a + (r.score ?? 0) * (r.effWeight / 100), 0).toFixed(2),
  );
  return { rows, total, percent: Number(((total / 4) * 100).toFixed(1)) };
}

/**
 * The same formula from parts the server already scored — the hub reads its
 * weighted total straight out of Postgres rather than shipping every answer to
 * the browser to add up again.
 */
export function weightedFromParts(
  weights: Weights,
  parts: { key: PartKey; score: number | null }[],
  groups: CompetencyGroup[],
): WeightedResult {
  const weightOf: Record<PartKey, number> = {
    kpi: weights.kpi,
    core: weights.core,
    functional: weights.functional,
    managerial: weights.managerial,
  };
  const applicable = parts.filter(
    (p) => p.key === "kpi" || groups.includes(p.key.toUpperCase() as CompetencyGroup),
  );
  const denom = applicable
    .filter((p) => p.score !== null)
    .reduce((a, p) => a + weightOf[p.key], 0);

  const rows: WeightRow[] = applicable.map((p) => ({
    key: p.key,
    weight: weightOf[p.key],
    score: p.score,
    effWeight:
      denom && p.score !== null
        ? Number(((weightOf[p.key] / denom) * 100).toFixed(1))
        : 0,
  }));

  if (!denom) return { rows, total: null, percent: null };
  const total = Number(
    rows.reduce((a, r) => a + (r.score ?? 0) * (r.effWeight / 100), 0).toFixed(2),
  );
  return { rows, total, percent: Number(((total / 4) * 100).toFixed(1)) };
}

/* ---------------------------------------------------------------- progress */

export const STATUS_DICT_KEY: Record<AssessmentStatus, string> = {
  "not-started": "status.notStarted",
  "in-progress": "status.inProgress",
  submitted: "status.submitted",
};

export function percentOf(answered: number, required: number): number {
  return required ? Math.round((answered / required) * 100) : 0;
}

/* ----------------------------------------------------------------- routing */

export const runHref = (mode: Mode, targetId: string) =>
  `/assessment/${mode}/${targetId}`;

/* ------------------------------------------------------------------ format */

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

export function formatDate(iso: string, lang: "en" | "th") {
  try {
    return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

/** English is the fallback whenever a Thai column is empty. */
export function pick(lang: "en" | "th", en: string, th?: string | null) {
  return lang === "th" && th ? th : en;
}
