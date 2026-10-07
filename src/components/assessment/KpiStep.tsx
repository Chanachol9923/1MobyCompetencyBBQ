"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Pill,
  ResponsiveTable,
} from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kpiScore, kpiWeightTotal, type KpiRow } from "./lib";
import type { KpiItemInput } from "@/app/(app)/assessment/actions";

type Draft = KpiItemInput & { key: string };

const blankDraft = (): Draft => ({
  key: `new-${Math.random().toString(36).slice(2, 9)}`,
  id: null,
  name: "",
  target: "",
  weight: 0,
});

/**
 * The KPI half of the assessment.
 *
 * The rows are `KpiItem` records for this person and this cycle, so the list is
 * editable here rather than hard-coded: a cycle starts with no KPI at all and
 * somebody has to write them down. The weights must total 100 — the shortfall
 * is shown as you type, and the server refuses the save if it does not add up.
 */
export function KpiStep({
  items,
  scores,
  onScore,
  onSaveItems,
  readOnly = false,
  saving = false,
}: {
  items: KpiRow[];
  /** local overrides for scores saved in this session */
  scores: Record<string, number | null>;
  onScore: (kpiItemId: string, score: number) => void;
  onSaveItems: (items: KpiItemInput[]) => void;
  readOnly?: boolean;
  saving?: boolean;
}) {
  const { t, tt } = useT();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  const scoreOf = (item: KpiRow) => scores[item.id] ?? item.score;
  const totalWeight = kpiWeightTotal(items);
  const weightOk = totalWeight === 100;
  const weighted = kpiScore(items, scores);
  const rated = items.filter((i) => scoreOf(i) !== null).length;

  /* ------------------------------------------------------------- editing */

  const startEdit = () =>
    setDrafts(
      items.length
        ? items.map((i) => ({
            key: i.id,
            id: i.id,
            name: i.name,
            target: i.target,
            weight: i.weight,
          }))
        : [blankDraft()],
    );

  const draftTotal = (drafts ?? []).reduce((a, d) => a + (d.weight || 0), 0);
  const draftValid =
    (drafts ?? []).every((d) => d.name.trim() && d.target.trim() && d.weight > 0) &&
    ((drafts ?? []).length === 0 || draftTotal === 100);

  if (drafts) {
    return (
      <Card>
        <CardHeader
          title={tt("Edit KPI items", "แก้ไขรายการ KPI")}
          subtitle={tt(
            "Name each indicator, say what success looks like, and give it a weight. The weights must total 100%.",
            "ตั้งชื่อตัวชี้วัด ระบุเป้าหมายที่ถือว่าสำเร็จ และกำหนดน้ำหนัก โดยน้ำหนักรวมต้องเท่ากับ 100%",
          )}
          right={
            <Pill tone={draftTotal === 100 ? "success" : "danger"}>
              {draftTotal}%
            </Pill>
          }
        />
        <div className="space-y-3 px-5 pb-5">
          {drafts.map((d, i) => (
            <div
              key={d.key}
              className="grid gap-2 rounded-lg border border-line/70 p-3 lg:grid-cols-[1fr_1fr_110px_auto] lg:items-start"
            >
              <Input
                value={d.name}
                aria-label={tt("KPI name", "ชื่อตัวชี้วัด")}
                placeholder={tt("KPI name", "ชื่อตัวชี้วัด")}
                onChange={(e) =>
                  setDrafts((ds) =>
                    (ds ?? []).map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                value={d.target}
                aria-label={tt("Target", "เป้าหมาย")}
                placeholder={tt("Target", "เป้าหมาย")}
                onChange={(e) =>
                  setDrafts((ds) =>
                    (ds ?? []).map((x, j) =>
                      j === i ? { ...x, target: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={d.weight || ""}
                aria-label={t("label.weight")}
                placeholder="%"
                onChange={(e) =>
                  setDrafts((ds) =>
                    (ds ?? []).map((x, j) =>
                      j === i
                        ? { ...x, weight: Number(e.target.value) || 0 }
                        : x,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("action.delete")}
                onClick={() =>
                  setDrafts((ds) => (ds ?? []).filter((_, j) => j !== i))
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrafts((ds) => [...(ds ?? []), blankDraft()])}
          >
            <Plus size={15} />
            {tt("Add KPI", "เพิ่ม KPI")}
          </Button>

          {!draftValid ? (
            <p className="break-words text-xs text-accent">
              {draftTotal === 100
                ? tt(
                    "Every KPI needs a name, a target and a weight.",
                    "KPI ทุกข้อต้องมีชื่อ เป้าหมาย และน้ำหนัก",
                  )
                : tt(
                    `Weights total ${draftTotal}% — they must add up to 100%.`,
                    `น้ำหนักรวม ${draftTotal}% ต้องรวมได้ 100%`,
                  )}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              disabled={!draftValid || saving}
              onClick={() => {
                onSaveItems(
                  drafts.map(({ key: _key, ...item }) => ({
                    ...item,
                    name: item.name.trim(),
                    target: item.target.trim(),
                  })),
                );
                setDrafts(null);
              }}
            >
              <Save size={16} />
              {t("action.save")}
            </Button>
            <Button variant="outline" onClick={() => setDrafts(null)}>
              <X size={16} />
              {t("action.cancel")}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /* -------------------------------------------------------------- empty */

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          title={tt("No KPI set for this cycle", "ยังไม่มี KPI สำหรับรอบนี้")}
          hint={tt("The KPI (results) part of the score has not been set for this cycle yet. Add the indicators, or continue with the competency steps.",
            "ยังไม่ได้กำหนด KPI (ผลลัพธ์งาน) สำหรับรอบนี้ เพิ่มตัวชี้วัด หรือทำขั้นตอนสมรรถนะต่อไปได้",
          )}
        />
        {!readOnly ? (
          <div className="px-5 pb-5">
            <Button onClick={startEdit}>
              <Plus size={16} />
              {tt("Add KPI items", "เพิ่มรายการ KPI")}
            </Button>
          </div>
        ) : null}
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
            <div className="flex items-center gap-2">
              <Pill tone={rated === items.length ? "success" : "neutral"}>
                {rated}/{items.length} {tt("rated", "ให้คะแนนแล้ว")}
              </Pill>
              {!readOnly ? (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil size={14} />
                  {t("action.edit")}
                </Button>
              ) : null}
            </div>
          }
        />

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
