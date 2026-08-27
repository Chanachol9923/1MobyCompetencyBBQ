"use client";

import { Card, CardHeader, Pill, Progress } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GAP_VERDICT_LABEL, type GapVerdict } from "@/data/competencies";
import type { Person } from "@/data/people";
import type { KpiItem, Weights } from "@/lib/store";
import { VerdictPill } from "./StatusPill";
import {
  gapRows,
  kpiKey,
  signed,
  verdictCounts,
  weightedTotal,
  type ManagerAnswers,
  type Mode,
} from "./lib";

const PART_KEY: Record<string, string> = {
  kpi: "group.kpi",
  core: "group.core",
  functional: "group.functional",
  managerial: "group.managerial",
};

const VERDICT_ORDER: GapVerdict[] = [
  "strength",
  "standard",
  "development",
  "critical",
];

const VERDICT_COLOR: Record<GapVerdict, string> = {
  strength: "text-success",
  standard: "text-brand",
  development: "text-[#b57408]",
  critical: "text-accent",
};

export function ResultStep({
  mode,
  target,
  answers,
  kpiItems,
  weights,
  managerAnswers,
}: {
  mode: Mode;
  target: Person;
  answers: Record<string, number>;
  kpiItems: KpiItem[];
  weights: Weights;
  managerAnswers: ManagerAnswers | null;
}) {
  const { t, tt, lang } = useT();

  const result = weightedTotal(target.jobRole, answers, kpiItems, weights);
  const rows = gapRows(target.jobRole, answers);
  const counts = verdictCounts(rows);
  const redistributed = result.rows.some(
    (r) => r.score !== null && Math.abs(r.effWeight - r.weight) > 0.05,
  );

  // 180°: self against the supervisor view
  const compare = mode === "self" && managerAnswers !== null;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ weighted total */}
      <Card>
        <CardHeader
          title={tt("Weighted result", "ผลคะแนนถ่วงน้ำหนัก")}
          subtitle={tt(
            "KPI (results) plus competency (behaviour), combined with the weights set by HR.",
            "คะแนน KPI (ผลลัพธ์) รวมกับสมรรถนะ (พฤติกรรม) ตามน้ำหนักที่ฝ่ายบุคคลกำหนด",
          )}
          right={
            <Pill tone={result.total === null ? "neutral" : "brand"}>
              {result.total === null ? "—" : `${result.percent}%`}
            </Pill>
          }
        />
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-muted">
                {tt("Total score", "คะแนนรวม")}
              </p>
              <p className="mt-0.5 text-4xl font-bold text-brand">
                {result.total === null ? "—" : result.total.toFixed(2)}
                <span className="text-lg font-medium text-muted"> / 4</span>
              </p>
            </div>
            <div className="min-w-[200px] flex-1">
              <Progress value={result.percent ?? 0} showLabel />
            </div>
          </div>

          {/* readable formula */}
          <div className="mt-5 rounded-lg border border-line/70 bg-surface/60 p-4">
            <p className="text-xs font-medium text-ink">
              {tt("How this is calculated", "วิธีคำนวณ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
              {result.rows.map((r, i) => (
                <span key={r.key} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-muted">+</span> : null}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1",
                      r.score === null
                        ? "border-line bg-white text-line-2"
                        : "border-brand/30 bg-white text-ink",
                    )}
                  >
                    <span className="text-xs font-medium text-muted">
                      {t(PART_KEY[r.key] ?? r.key)}
                    </span>
                    <b>{r.score === null ? "—" : r.score.toFixed(2)}</b>
                    <span className="text-xs text-muted">
                      × {r.effWeight.toFixed(1)}%
                    </span>
                  </span>
                </span>
              ))}
              <span className="text-muted">=</span>
              <span className="rounded-md bg-brand px-2.5 py-1 text-sm font-bold text-white">
                {result.total === null ? "—" : result.total.toFixed(2)} / 4
              </span>
            </div>
            {redistributed ? (
              <p className="mt-2 break-words text-xs leading-relaxed text-muted">
                {tt(
                  `Configured weights are KPI ${weights.kpi}% / Core ${weights.core}% / Functional ${weights.functional}% / Managerial ${weights.managerial}%. Parts this role is not assessed on are removed and their weight is shared out proportionally.`,
                  `น้ำหนักที่ตั้งไว้คือ KPI ${weights.kpi}% / Core ${weights.core}% / Functional ${weights.functional}% / Managerial ${weights.managerial}% ส่วนที่ตำแหน่งนี้ไม่ถูกประเมินจะถูกตัดออก และเฉลี่ยน้ำหนักไปยังส่วนที่เหลือตามสัดส่วน`,
                )}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------- verdict counts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VERDICT_ORDER.map((v) => (
          <Card key={v} className="p-4">
            <p className="break-words text-xs text-muted">
              {GAP_VERDICT_LABEL[v][lang]}
            </p>
            <p className={cn("mt-1 text-2xl font-bold", VERDICT_COLOR[v])}>
              {counts[v]}
            </p>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------ competency table */}
      <Card>
        <CardHeader
          title={tt("Competency detail", "รายละเอียดสมรรถนะ")}
          subtitle={tt(
            "Gap = score − expected level for this job role. Only competencies this role is assessed on are shown.",
            "ส่วนต่าง = คะแนน − ระดับที่คาดหวังของตำแหน่งนี้ แสดงเฉพาะสมรรถนะที่ตำแหน่งนี้ถูกประเมิน",
          )}
        />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">
                  {tt("Competency", "สมรรถนะ")}
                </th>
                <th className="py-2 font-medium">{tt("Group", "กลุ่ม")}</th>
                <th className="py-2 text-center font-medium">
                  {mode === "self"
                    ? tt("Self", "ตนเอง")
                    : tt("Supervisor", "หัวหน้า")}
                </th>
                {compare ? (
                  <th className="py-2 text-center font-medium">
                    {tt("Supervisor", "หัวหน้า")}
                  </th>
                ) : null}
                {compare ? (
                  <th className="py-2 text-center font-medium">
                    {tt("Diff", "ต่างกัน")}
                  </th>
                ) : null}
                <th className="py-2 text-center font-medium">
                  {t("label.expected")}
                </th>
                <th className="py-2 text-center font-medium">
                  {t("label.gap")}
                </th>
                <th className="py-2 text-right font-medium">
                  {tt("Verdict", "ผลการวิเคราะห์")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mgr = managerAnswers?.answers[r.competency.id] ?? null;
                const diff =
                  compare && r.score !== null && mgr !== null
                    ? r.score - mgr
                    : null;
                return (
                  <tr
                    key={r.competency.id}
                    className="border-b border-line/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-ink">
                      {r.competency.name}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">
                      {t(PART_KEY[r.competency.group] ?? r.competency.group)}
                    </td>
                    <td className="py-2.5 text-center">
                      {r.score ? (
                        <b className="text-ink">{r.score}</b>
                      ) : (
                        <span className="text-line-2">—</span>
                      )}
                    </td>
                    {compare ? (
                      <td className="py-2.5 text-center">
                        {mgr ? (
                          <b className="text-ink">{mgr}</b>
                        ) : (
                          <span className="text-line-2">—</span>
                        )}
                      </td>
                    ) : null}
                    {compare ? (
                      <td className="py-2.5 text-center">
                        {diff === null ? (
                          <span className="text-line-2">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-bold",
                              diff > 0 && "text-accent",
                              diff === 0 && "text-muted",
                              diff < 0 && "text-brand",
                            )}
                          >
                            {signed(diff)}
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className="py-2.5 text-center text-muted">
                      {r.expected ?? "—"}
                    </td>
                    <td className="py-2.5 text-center">
                      {r.gap === null ? (
                        <span className="text-line-2">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-bold",
                            r.gap > 0 && "text-success",
                            r.gap === 0 && "text-muted",
                            r.gap < 0 && "text-accent",
                          )}
                        >
                          {signed(r.gap)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {r.verdict ? (
                        <VerdictPill verdict={r.verdict} />
                      ) : (
                        <span className="text-line-2">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {compare ? (
            <p className="mt-3 break-words text-xs leading-relaxed text-muted">
              {tt(
                `Diff is your own rating minus your supervisor's — a positive number means you rated yourself higher. ${
                  managerAnswers?.source === "seed"
                    ? "The supervisor column comes from the last completed review cycle."
                    : "The supervisor column comes from the review submitted in this cycle."
                }`,
                `ช่อง “ต่างกัน” คือคะแนนที่คุณให้ตนเอง ลบด้วยคะแนนจากหัวหน้า ค่าบวกหมายถึงคุณประเมินตนเองสูงกว่า ${
                  managerAnswers?.source === "seed"
                    ? "คะแนนหัวหน้ามาจากรอบการประเมินก่อนหน้า"
                    : "คะแนนหัวหน้ามาจากผลการประเมินที่ส่งในรอบนี้"
                }`,
              )}
            </p>
          ) : null}
        </div>
      </Card>

      {/* -------------------------------------------------------- KPI recap */}
      {kpiItems.length ? (
        <Card>
          <CardHeader
            title={tt("KPI detail", "รายละเอียด KPI")}
            subtitle={tt(
              "The results half of the score.",
              "ส่วนของผลลัพธ์การทำงาน",
            )}
          />
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">{tt("KPI", "ตัวชี้วัด")}</th>
                  <th className="py-2 font-medium">
                    {tt("Target", "เป้าหมาย")}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {tt("Weight", "น้ำหนัก")}
                  </th>
                  <th className="py-2 text-center font-medium">
                    {tt("Score", "คะแนน")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpiItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-line/60 align-top last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium leading-relaxed text-ink">
                      {item.name}
                    </td>
                    <td className="py-2.5 pr-3 leading-relaxed text-muted">
                      {item.target}
                    </td>
                    <td className="py-2.5 text-right text-muted">
                      {item.weight}%
                    </td>
                    <td className="py-2.5 text-center">
                      {answers[kpiKey(item.id)] ? (
                        <b className="text-ink">{answers[kpiKey(item.id)]}</b>
                      ) : (
                        <span className="text-line-2">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
