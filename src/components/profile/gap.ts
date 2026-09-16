/**
 * The client-side half of the gap engine.
 *
 * The maths itself lives on the server in `src/server/competency.ts` — this
 * module carries only what a browser bundle needs: the row shapes it receives,
 * the wording of a verdict, and the formatting helpers the charts share.
 * Nothing here reads a database or a store; everything arrives as props.
 *
 * The two client rules from the requirement pack still hold, because the server
 * already applied them before the rows got here:
 *   1. a competency the career role has no expected level for is absent — it is
 *      never a zero and never a radar spoke;
 *   2. gap = supervisor score − expected level.
 */

import type { GapRow as ServerGapRow, GapVerdict } from "@/server/competency";

// `import type` is erased at compile time, so importing the shape of a
// server-only module costs the client bundle nothing.
export type { GapVerdict };

/** A server gap row plus the Thai competency name, picked by `lang`. */
export type GapRow = ServerGapRow & { nameTh: string | null };

const round2 = (n: number) => Number(n.toFixed(2));
export { round2 };

/* ---------------------------------------------------------------- groups */

export type CompetencyGroup = "CORE" | "FUNCTIONAL" | "MANAGERIAL";

export const COMPETENCY_GROUPS: CompetencyGroup[] = [
  "CORE",
  "FUNCTIONAL",
  "MANAGERIAL",
];

/** Reuses the shared dictionary rather than a second copy of the wording. */
export const groupDictKey = (g: CompetencyGroup) =>
  `group.${g.toLowerCase()}` as const;

/* --------------------------------------------------------------- verdicts */

/** Mirrors `VERDICT_LABEL` in `src/server/competency.ts`, which a client bundle
 *  cannot import because that module is server-only. */
export const VERDICT_LABEL: Record<GapVerdict, { en: string; th: string }> = {
  strength: { en: "Strength", th: "จุดแข็ง" },
  standard: { en: "Competency Fit", th: "ตรงตามมาตรฐาน" },
  development: { en: "Development", th: "ควรพัฒนา" },
  critical: { en: "Critical", th: "ต้องพัฒนาเร่งด่วน" },
};

export const VERDICT_ORDER: GapVerdict[] = [
  "strength",
  "standard",
  "development",
  "critical",
];

export function verdictFor(gap: number): GapVerdict {
  if (gap > 0) return "strength";
  if (gap === 0) return "standard";
  if (gap > -1) return "development";
  return "critical";
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

/* -------------------------------------------------------------- language */

export type Lang = "en" | "th";

/** English is the fallback whenever a Thai column is empty. */
export function pick(lang: Lang, en: string, th?: string | null) {
  return lang === "th" && th ? th : en;
}

export function nameOf(
  row: { nameEn: string; nameTh?: string | null },
  lang: Lang,
) {
  return pick(lang, row.nameEn, row.nameTh);
}

export function definitionOf(
  row: { definitionEn?: string | null; definitionTh?: string | null },
  lang: Lang,
) {
  return (
    (lang === "th" ? row.definitionTh : row.definitionEn) ??
    row.definitionEn ??
    undefined
  );
}

/* ------------------------------------------------------------ formatting */

/** "+0.5" / "0" / "-1.25" — signed, trimmed. */
export function formatGap(gap: number) {
  const rounded = round2(gap);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

/** Radar spokes — expectation against the official score. */
export function toRadarData(rows: GapRow[], lang: Lang) {
  return rows.map((r) => ({
    skill: nameOf(r, lang),
    expectation: r.expected,
    actual: r.score ?? 0,
  }));
}

/* ------------------------------------------------------- aggregate shape */

/**
 * One competency rolled up over a scope. The server builds these with a single
 * aggregate query — the browser only sorts and renders them.
 */
export type AggRow = {
  competencyId: string;
  nameEn: string;
  nameTh: string | null;
  group: CompetencyGroup;
  /** average official score across the people assessed on this competency */
  avgScore: number;
  avgSelf: number;
  avgExpected: number;
  gap: number;
  verdict: GapVerdict;
  /** how many people in scope are assessed on it */
  assessedCount: number;
  /** how many of those sit below their own expected level */
  belowCount: number;
  /** the highest scorer in scope, for the "who is good at what" read */
  topName: string | null;
  topScore: number;
};

/** One person rolled up over the same scope. */
export type ScopePerson = {
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
