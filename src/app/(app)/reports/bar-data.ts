import { VERDICT_HEX } from "@/components/profile/VerdictPill";
import { nameOf, type AggRow, type Lang } from "@/components/profile/gap";

/**
 * The bar chart's rows. Kept apart from the chart so the reports page can
 * build them without pulling the chart library into its first load.
 */
export type BarDatum = {
  name: string;
  actual: number;
  expected: number;
  fill: string;
};

export function toBarData(rows: AggRow[], lang: Lang): BarDatum[] {
  return rows.map((r) => ({
    name: nameOf(r, lang),
    actual: r.avgScore,
    expected: r.avgExpected,
    fill: VERDICT_HEX[r.verdict],
  }));
}

/** The chart's height for this many rows — reserved while it loads. */
export const barChartHeight = (rows: number) => Math.max(240, rows * 52 + 56);
