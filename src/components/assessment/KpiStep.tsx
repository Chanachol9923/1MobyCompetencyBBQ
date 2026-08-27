"use client";

import { Card, CardHeader, EmptyState, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RATING_LABELS } from "@/data/competencies";
import type { KpiItem } from "@/lib/store";
import { kpiKey, kpiScore, kpiWeightTotal } from "./lib";

export function KpiStep({
  items,
  answers,
  onChange,
  readOnly = false,
}: {
  items: KpiItem[];
  answers: Record<string, number>;
  onChange: (kpiItemId: string, score: number) => void;
  readOnly?: boolean;
}) {
  const { t, tt, lang } = useT();
  const totalWeight = kpiWeightTotal(items);
  const weightOk = totalWeight === 100;
  const score = kpiScore(items, answers);
  const rated = items.filter((i) => answers[kpiKey(i.id)]).length;

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          title={tt("No KPI set for this cycle", "ยังไม่มี KPI สำหรับรอบนี้")}
          hint={tt(
            "The administrator has not assigned KPI items yet.",
            "ผู้ดูแลระบบยังไม่ได้กำหนดรายการ KPI",
          )}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={tt("Key Performance Indicators", "ตัวชี้วัดผลงานหลัก (KPI)")}
          subtitle={tt(
            "The results half of the score. Rate each KPI 1–4 against its target.",
            "ส่วนของผลลัพธ์การทำงาน ให้คะแนนแต่ละ KPI 1–4 เทียบกับเป้าหมาย",
          )}
          right={
            <Pill tone={rated === items.length ? "success" : "neutral"}>
              {rated}/{items.length} {tt("rated", "ให้คะแนนแล้ว")}
            </Pill>
          }
        />

        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-8 py-2 font-medium">#</th>
                <th className="py-2 font-medium">{tt("KPI", "ตัวชี้วัด")}</th>
                <th className="py-2 font-medium">{tt("Target", "เป้าหมาย")}</th>
                <th className="py-2 text-right font-medium">
                  {tt("Weight", "น้ำหนัก")}
                </th>
                <th className="py-2 pl-4 font-medium">
                  {tt("Score", "คะแนน")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const value = answers[kpiKey(item.id)];
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
                            title={
                              lang === "th" ? t(`rating.${r}`) : RATING_LABELS[r]
                            }
                            onClick={() => onChange(item.id, r)}
                            className={cn(
                              "grid size-9 place-items-center rounded-lg border text-sm font-bold transition-all",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                              "disabled:cursor-not-allowed",
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
            <tfoot>
              <tr className="border-t border-line">
                <td />
                <td className="py-3 font-bold text-ink" colSpan={2}>
                  {tt("Total weight", "น้ำหนักรวม")}
                </td>
                <td
                  className={cn(
                    "py-3 text-right font-bold",
                    weightOk ? "text-success" : "text-accent",
                  )}
                >
                  {totalWeight}%
                </td>
                <td className="py-3 pl-4">
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
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs text-muted">
            {tt("Weighted KPI score", "คะแนน KPI ถ่วงน้ำหนัก")}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-brand">
            {score === null ? "—" : score.toFixed(2)}
            <span className="text-base font-medium text-muted"> / 4</span>
          </p>
        </div>
        <p className="max-w-md break-words text-xs leading-relaxed text-muted">
          {tt(
            "Each KPI score is multiplied by its weight, then divided by the weight of the KPIs you have rated.",
            "คะแนนของแต่ละ KPI จะถูกคูณด้วยน้ำหนัก แล้วหารด้วยน้ำหนักรวมของ KPI ที่ให้คะแนนแล้ว",
          )}
        </p>
      </Card>
    </div>
  );
}
