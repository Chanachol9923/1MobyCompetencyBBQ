"use client";

import { Card, CardHeader, Pill, Progress, ResponsiveTable } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { VERDICT_LABEL, VERDICT_ORDER, verdictFor } from "@/components/profile/gap";
import { VerdictPill } from "./StatusPill";
import {
  PART_DICT_KEY,
  groupDictKey,
  pick,
  signed,
  weightedTotal,
  type CompetencyQuestion,
  type KpiRow,
  type Mode,
  type Weights,
} from "./lib";

const VERDICT_COLOR = {
  strength: "text-success",
  standard: "text-brand",
  development: "text-[#b57408]",
  critical: "text-accent",
} as const;

/**
 * The result step: the weighted total with its formula spelled out, the gap
 * table, and — in self mode — the 180° comparison against the supervisor's own
 * scores.
 *
 * The maths is recomputed in the browser from the answers on screen so the
 * figure moves as the wizard is filled in, but it is the same pure function the
 * hub uses on the server, so the two can never disagree.
 */
export function ResultStep({
  mode,
  weights,
  competencies,
  scores,
  kpis,
  kpiScores,
  counterpart,
}: {
  mode: Mode;
  weights: Weights;
  competencies: CompetencyQuestion[];
  scores: Record<string, number | undefined>;
  kpis: KpiRow[];
  kpiScores: Record<string, number | null>;
  /** the other half of the 180°, when it has been submitted */
  counterpart: { scores: Record<string, number>; submittedAt: string } | null;
}) {
  const { t, tt, lang } = useT();

  const result = weightedTotal({
    weights,
    competencies,
    scores,
    kpis,
    kpiScores,
  });

  const rows = competencies.map((c) => {
    const score = scores[c.id] ?? null;
    const gap = score === null ? null : score - c.expected;
    return { competency: c, score, gap, verdict: gap === null ? null : verdictFor(gap) };
  });

  const counts = { strength: 0, standard: 0, development: 0, critical: 0 };
  for (const r of rows) if (r.verdict) counts[r.verdict] += 1;

  const redistributed = result.rows.some(
    (r) => r.score !== null && Math.abs(r.effWeight - r.weight) > 0.05,
  );

  // 180°: a self assessment sits next to the supervisor's view of the same person
  const compare = counterpart !== null;
  const counterpartLabel =
    mode === "self"
      ? tt("Supervisor", "หัวหน้า")
      : tt("Self", "ตนเอง");

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ weighted total */}
      <Card>
        <CardHeader
          title={tt("Weighted result", "ผลคะแนนถ่วงน้ำหนัก")}
          subtitle={tt(
            "KPI (results) plus competency (behaviour), combined with the weights set by HR on this cycle.",
            "คะแนน KPI (ผลลัพธ์) รวมกับสมรรถนะ (พฤติกรรม) ตามน้ำหนักที่ฝ่ายบุคคลกำหนดไว้ในรอบนี้",
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
              <p className="text-xs text-muted">{tt("Total score", "คะแนนรวม")}</p>
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
                      {t(PART_DICT_KEY[r.key])}
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
                {tt(`Weights for this cycle: KPI ${weights.kpi}% / Core ${weights.core}% / Functional ${weights.functional}% / Managerial ${weights.managerial}%. Parts this career role is not assessed on are left out and their weight is shared among the rest.`,
                  `น้ำหนักของรอบนี้: KPI ${weights.kpi}% / สมรรถนะหลัก ${weights.core}% / สมรรถนะตามสายงาน ${weights.functional}% / สมรรถนะการบริหาร ${weights.managerial}% ส่วนที่บทบาทนี้ไม่ได้ประเมินจะถูกตัดออก และแบ่งน้ำหนักให้ส่วนที่เหลือตามสัดส่วน`,
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
              {VERDICT_LABEL[v][lang]}
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
          subtitle={tt("Gap = score − expected level for this career role. Only competencies this role is assessed on are shown.",
            "ส่วนต่าง = คะแนน − ระดับที่คาดหวังของบทบาทนี้ แสดงเฉพาะสมรรถนะที่บทบาทนี้ต้องประเมิน",
          )}
        />
        <ResponsiveTable className="px-5 pb-5">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">{t("label.competency")}</th>
                <th className="py-2 font-medium">{tt("Group", "กลุ่ม")}</th>
                <th className="py-2 text-center font-medium">
                  {mode === "self"
                    ? tt("Self", "ตนเอง")
                    : tt("Supervisor", "หัวหน้า")}
                </th>
                {compare ? (
                  <th className="py-2 text-center font-medium">
                    {counterpartLabel}
                  </th>
                ) : null}
                {compare ? (
                  <th className="py-2 text-center font-medium">
                    {tt("Difference", "ส่วนต่าง")}
                  </th>
                ) : null}
                <th className="py-2 text-center font-medium">
                  {t("label.expected")}
                </th>
                <th className="py-2 text-center font-medium">{t("label.gap")}</th>
                <th className="py-2 text-right font-medium">
                  {tt("Verdict", "ผลการวิเคราะห์")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const other = counterpart?.scores[r.competency.id] ?? null;
                const diff =
                  compare && r.score !== null && other !== null
                    ? r.score - other
                    : null;
                return (
                  <tr
                    key={r.competency.id}
                    className="border-b border-line/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-ink">
                      {pick(lang, r.competency.nameEn, r.competency.nameTh)}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">
                      {t(groupDictKey(r.competency.group))}
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
                        {other ? (
                          <b className="text-ink">{other}</b>
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
                      {r.competency.expected}
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
        </ResponsiveTable>

        {compare ? (
          <p className="break-words px-5 pb-5 text-xs leading-relaxed text-muted">
            {mode === "self"
              ? tt("Difference is your own rating minus your supervisor's — a positive number means you rated yourself higher. Supervisor scores come from this cycle's review.",
                  "ส่วนต่าง คือคะแนนที่คุณให้ตนเอง ลบด้วยคะแนนจากหัวหน้า ค่าบวกหมายถึงคุณประเมินตนเองสูงกว่า คะแนนหัวหน้ามาจากการประเมินในรอบนี้",
                )
              : tt("Difference is your rating minus their own — a positive number means you rated them higher than they rated themselves.",
                  "ส่วนต่าง คือคะแนนที่คุณให้ ลบด้วยคะแนนที่เจ้าตัวให้ตนเอง ค่าบวกหมายถึงคุณให้คะแนนสูงกว่าที่เจ้าตัวให้ตนเอง",
                )}
          </p>
        ) : null}
      </Card>

      {/* -------------------------------------------------------- KPI recap */}
      {kpis.length ? (
        <Card>
          <CardHeader
            title={tt("KPI detail", "รายละเอียด KPI")}
            subtitle={tt(
              "The results half of the score.",
              "ส่วนของผลลัพธ์การทำงาน",
            )}
          />
          <ResponsiveTable className="px-5 pb-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">{tt("KPI", "ตัวชี้วัด")}</th>
                  <th className="py-2 font-medium">{tt("Target", "เป้าหมาย")}</th>
                  <th className="py-2 text-right font-medium">
                    {t("label.weight")}
                  </th>
                  <th className="py-2 text-center font-medium">
                    {tt("Score", "คะแนน")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((item) => {
                  const value = kpiScores[item.id] ?? item.score;
                  return (
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
                        {value ? (
                          <b className="text-ink">{value}</b>
                        ) : (
                          <span className="text-line-2">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      ) : null}
    </div>
  );
}
