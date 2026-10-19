"use client";

import { Building2 } from "lucide-react";
import {
  Card,
  CardHeader,
  EmptyState,
  Pill,
  ResponsiveTable,
} from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kpiScore, kpiWeightTotal, type KpiRow } from "./lib";

/**
 * The KPI half of the assessment.
 *
 * The rows are `KpiItem` records for this person and this cycle. The company
 * sets them — HR, in the assessment admin — so here they are read-only: the
 * employee and the supervisor only rate each one against its target.
 */
export function KpiStep({
  items,
  scores,
  onScore,
  readOnly = false,
}: {
  items: KpiRow[];
  /** local overrides for scores saved in this session */
  scores: Record<string, number | null>;
  onScore: (kpiItemId: string, score: number) => void;
  readOnly?: boolean;
}) {
  const { t, tt } = useT();

  const scoreOf = (item: KpiRow) => scores[item.id] ?? item.score;
  const totalWeight = kpiWeightTotal(items);
  const weightOk = totalWeight === 100;
  const weighted = kpiScore(items, scores);
  const rated = items.filter((i) => scoreOf(i) !== null).length;

  /* -------------------------------------------------------------- empty */

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          title={tt("No KPI set for this cycle yet", "ยังไม่มี KPI สำหรับรอบนี้")}
          hint={tt(
            "KPIs are set by the company (HR). Until yours are set, continue with the competency steps — the KPI part can be rated once they arrive.",
            "KPI กำหนดโดยบริษัท (ฝ่าย HR) ระหว่างที่ยังไม่ได้กำหนด ทำขั้นตอนสมรรถนะต่อไปได้เลย แล้วค่อยกลับมาให้คะแนน KPI เมื่อกำหนดแล้ว",
          )}
        />
      </Card>
    );
  }

  /* --------------------------------------------------------------- list */

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={tt("Key Performance Indicators", "ตัวชี้วัดผลงานหลัก (KPI)")}
          subtitle={tt("The KPI (results) part of the score. Rate each KPI 1–4 against its target.",
            "ส่วน KPI (ผลลัพธ์งาน) ของคะแนน ให้คะแนนแต่ละ KPI 1–4 เทียบกับเป้าหมาย",
          )}
          right={
            <Pill tone={rated === items.length ? "success" : "neutral"}>
              {rated}/{items.length} {tt("rated", "ให้คะแนนแล้ว")}
            </Pill>
          }
        />

        <p className="mx-5 mb-3 flex items-center gap-1.5 text-xs text-muted">
          <Building2 size={13} className="shrink-0" />
          {tt(
            "Set by the company (HR) for this cycle. Ask HR if a KPI or its target needs changing.",
            "กำหนดโดยบริษัท (ฝ่าย HR) สำหรับรอบนี้ หาก KPI หรือเป้าหมายต้องปรับ ให้แจ้งฝ่าย HR",
          )}
        </p>

        <ResponsiveTable className="px-5 pb-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-8 py-2 font-medium">#</th>
                <th className="py-2 font-medium">{tt("KPI", "ตัวชี้วัด")}</th>
                <th className="py-2 font-medium">{tt("Target", "เป้าหมาย")}</th>
                <th className="py-2 text-right font-medium">
                  {t("label.weight")}
                </th>
                <th className="py-2 pl-4 font-medium">{tt("Score", "คะแนน")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const value = scoreOf(item);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-line/60 align-top last:border-0"
                  >
                    <td className="py-3 text-muted">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium leading-relaxed text-ink">
                      {item.name}
                    </td>
                    <td className="py-3 pr-4 leading-relaxed text-muted">
                      {item.target}
                    </td>
                    <td className="py-3 text-right font-bold text-ink">
                      {item.weight}%
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={readOnly}
                            aria-pressed={value === r}
                            title={t(`rating.${r}`)}
                            onClick={() => onScore(item.id, r)}
                            className={cn(
                              "grid size-9 place-items-center rounded-lg border text-sm font-bold transition-all",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                              "disabled:cursor-not-allowed max-lg:size-11",
                              value === r
                                ? "border-brand bg-brand text-white"
                                : "border-line bg-white text-ink hover:border-line-2 hover:bg-surface",
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      {value ? (
                        <p className="mt-1 text-[11px] text-muted">
                          {t(`rating.${value}`)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>

        {/* the total sits outside the table: `ResponsiveTable` folds rows into
            cards on phones and a <tfoot> would not survive the fold */}
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/70 bg-surface/50 px-4 py-3">
          <span className="text-sm font-bold text-ink">
            {tt("Total weight", "น้ำหนักรวม")}
          </span>
          <span className="flex items-center gap-3">
            <b
              className={cn(
                "text-sm",
                weightOk ? "text-success" : "text-accent",
              )}
            >
              {totalWeight}%
            </b>
            {weightOk ? (
              <Pill tone="success">{tt("Sums to 100%", "ครบ 100%")}</Pill>
            ) : (
              <Pill tone="danger">
                {tt(
                  `Must sum to 100% (${100 - totalWeight > 0 ? "+" : ""}${100 - totalWeight})`,
                  `ต้องรวมได้ 100% (${100 - totalWeight > 0 ? "+" : ""}${100 - totalWeight})`,
                )}
              </Pill>
            )}
          </span>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs text-muted">
            {tt("Weighted KPI score", "คะแนน KPI ถ่วงน้ำหนัก")}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-brand">
            {weighted === null ? "—" : weighted.toFixed(2)}
            <span className="text-base font-medium text-muted"> / 4</span>
          </p>
        </div>
        <p className="max-w-md break-words text-xs leading-relaxed text-muted">
          {tt(
            "Each KPI score is multiplied by its weight, then divided by the weight of the KPIs that have been rated.",
            "คะแนนของแต่ละ KPI จะถูกคูณด้วยน้ำหนัก แล้วหารด้วยน้ำหนักรวมของ KPI ที่ให้คะแนนแล้ว",
          )}
        </p>
      </Card>
    </div>
  );
}
