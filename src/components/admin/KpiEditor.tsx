"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Modal, Pill } from "@/components/ui";
import type { ActionResult, CycleStatusRow } from "@/components/admin/content-types";
import { saveEmployeeKpis } from "@/server/admin-content";
import { useT } from "@/lib/i18n";

type Draft = { key: string; name: string; target: string; weight: number };

const blank = (): Draft => ({ key: Math.random().toString(36).slice(2, 9), name: "", target: "", weight: 0 });

/**
 * HR sets one person's KPIs for the open cycle — or the same set for everyone
 * in their career role. The weights must total 100; the server checks again.
 */
export function KpiEditor({
  employee,
  roleHeadcount,
  onClose,
  onDone,
}: {
  employee: CycleStatusRow;
  /** active people in the same career role, this person included */
  roleHeadcount: number;
  onClose: () => void;
  onDone: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    employee.kpis.length
      ? employee.kpis.map((k) => ({ key: k.id, name: k.name, target: k.target, weight: k.weight }))
      : [blank()],
  );
  const [applyToRole, setApplyToRole] = useState(false);
  const [busy, startTransition] = useTransition();

  const total = drafts.reduce((a, d) => a + (d.weight || 0), 0);
  const complete = drafts.every((d) => d.name.trim() && d.target.trim() && d.weight > 0);
  const valid = complete && (drafts.length === 0 || total === 100);
  const scored = employee.kpis.filter((k) => k.score !== null).length;

  const set = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = () =>
    startTransition(async () => {
      const result = await saveEmployeeKpis({
        employeeId: employee.id,
        applyToRole,
        items: drafts.map((d) => ({ name: d.name.trim(), target: d.target.trim(), weight: d.weight })),
      });
      onDone(result);
      if (result.ok) onClose();
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={tt(`KPIs — ${employee.name}`, `KPI — ${employee.name}`)}
      subtitle={tt(
        "Name each indicator, say what success looks like, and give it a weight. The weights must total 100%. The employee and their supervisor rate these in the assessment.",
        "ตั้งชื่อตัวชี้วัด ระบุเป้าหมายที่ถือว่าสำเร็จ และกำหนดน้ำหนัก (รวมต้องเท่ากับ 100%) พนักงานและหัวหน้าจะให้คะแนน KPI เหล่านี้ในการประเมิน",
      )}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button disabled={!valid || busy} onClick={save}>
            {applyToRole
              ? tt(`Save for ${roleHeadcount} people`, `บันทึกให้ ${roleHeadcount} คน`)
              : t("action.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {employee.jobRoleName}
            {employee.departmentName ? ` · ${employee.departmentName}` : ""}
          </p>
          <Pill tone={total === 100 ? "success" : "danger"}>
            {tt("Total", "รวม")} {total}%
          </Pill>
        </div>

        {drafts.map((d, i) => (
          <div
            key={d.key}
            className="grid gap-2 rounded-lg border border-line/70 p-3 sm:grid-cols-[1fr_1fr_96px_auto] sm:items-start"
          >
            <Input
              value={d.name}
              aria-label={tt("KPI name", "ชื่อตัวชี้วัด")}
              placeholder={tt("KPI name, e.g. On-time delivery", "ชื่อตัวชี้วัด เช่น ส่งงานตรงเวลา")}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <Input
              value={d.target}
              aria-label={tt("Target", "เป้าหมาย")}
              placeholder={tt("Target, e.g. ≥ 95% of tasks", "เป้าหมาย เช่น ≥ 95% ของงาน")}
              onChange={(e) => set(i, { target: e.target.value })}
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={d.weight || ""}
              aria-label={t("label.weight")}
              placeholder="%"
              onChange={(e) => set(i, { weight: Number(e.target.value) || 0 })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("action.delete")}
              onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={() => setDrafts((ds) => [...ds, blank()])}>
          <Plus size={15} />
          {tt("Add KPI", "เพิ่ม KPI")}
        </Button>

        {employee.selfSubmitted || employee.supervisorSubmitted ? (
          <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs leading-relaxed text-ink">
            {tt(
              `${employee.name} has already submitted this cycle's assessment (${[employee.selfSubmitted && "self", employee.supervisorSubmitted && "supervisor"].filter(Boolean).join(", ")}). New KPIs stay unrated — and the KPI weight is shared among the other parts — until that assessment is reopened and the KPIs rated.`,
              `${employee.name} ส่งการประเมินรอบนี้แล้ว (${[employee.selfSubmitted && "ตนเอง", employee.supervisorSubmitted && "หัวหน้า"].filter(Boolean).join(", ")}) KPI ที่เพิ่มใหม่จะยังไม่มีคะแนน และน้ำหนักส่วน KPI จะถูกแบ่งไปให้ส่วนอื่น จนกว่าจะเปิดการประเมินกลับมาแก้และให้คะแนน KPI`,
            )}
          </p>
        ) : null}

        {!valid && drafts.some((d) => d.name || d.target || d.weight) ? (
          <p className="text-xs text-accent">
            {!complete
              ? tt("Every KPI needs a name, a target and a weight.", "KPI ทุกข้อต้องมีชื่อ เป้าหมาย และน้ำหนัก")
              : tt(`Weights total ${total}% — they must add up to 100%.`, `น้ำหนักรวม ${total}% ต้องรวมได้ 100%`)}
          </p>
        ) : drafts.length === 0 && employee.kpis.length ? (
          <p className="text-xs text-amber">
            {tt("Saving with no rows clears this person's KPIs and their scores.", "บันทึกโดยไม่มีรายการ จะลบ KPI และคะแนนของคนนี้ทั้งหมด")}
          </p>
        ) : null}

        {roleHeadcount > 1 ? (
          <label className="flex items-start gap-2 rounded-lg bg-surface/70 p-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={applyToRole}
              onChange={(e) => setApplyToRole(e.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            <span>
              {tt(
                `Use this set for everyone in ${employee.jobRoleName} (${roleHeadcount} people)`,
                `ใช้ชุดนี้กับทุกคนในบทบาท ${employee.jobRoleName} (${roleHeadcount} คน)`,
              )}
              <span className="block text-xs text-muted">
                {tt(
                  "Their current KPIs are replaced; a KPI with the same name keeps its score.",
                  "KPI เดิมของแต่ละคนจะถูกแทนที่ ข้อที่ชื่อเดียวกันจะเก็บคะแนนเดิมไว้",
                )}
              </span>
            </span>
          </label>
        ) : null}

        {scored ? (
          <p className="text-xs text-muted">
            {tt(
              `${scored} of these KPIs already have a score. Renaming a KPI or removing it drops its score.`,
              `KPI ${scored} ข้อมีคะแนนแล้ว การเปลี่ยนชื่อหรือลบ KPI จะทำให้คะแนนของข้อนั้นหายไป`,
            )}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
