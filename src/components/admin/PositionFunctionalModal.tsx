"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Note } from "@/components/admin/shared";
import type {
  ActionResult,
  FunctionalSetImpact,
  FunctionalSetsData,
  OrgUnitRow,
} from "@/components/admin/content-types";
import {
  previewPositionFunctionalSet,
  setPositionFunctionalSet,
} from "@/server/functional-sets";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Which functional competencies one position is assessed on.
 *
 * Two steps, like a matrix cell: choose, then see what it does — how many
 * people, what they gain and lose, how many scores stop counting — and only
 * then save. The brief asks for five per position; any other number is
 * allowed but called out.
 */
export function PositionFunctionalModal({
  position,
  functional,
  canEdit,
  onClose,
  onResult,
}: {
  /** null = closed */
  position: OrgUnitRow | null;
  functional: FunctionalSetsData;
  canEdit: boolean;
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { tt, lang } = useT();
  const [useDefault, setUseDefault] = useState(true);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [impact, setImpact] = useState<FunctionalSetImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // a fresh form each time a position is opened
  useEffect(() => {
    if (!position) return;
    const own = functional.sets[position.id];
    setUseDefault(!own);
    setChosen(new Set(own ?? functional.competencies.filter((c) => c.defaultFunctional).map((c) => c.id)));
    setImpact(null);
    setError(null);
  }, [position, functional]);

  const name = (c: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (c.nameTh ?? c.nameEn) : c.nameEn;
  const byId = new Map(functional.competencies.map((c) => [c.id, c]));
  const defaults = functional.competencies.filter((c) => c.defaultFunctional);
  const size = useDefault ? defaults.length : chosen.size;
  const editable = canEdit && functional.ready;

  const payload = () => ({
    positionId: position?.id ?? "",
    competencyIds: useDefault ? null : [...chosen],
  });

  function toggle(id: string) {
    setImpact(null);
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function preview() {
    setError(null);
    startTransition(async () => {
      const res = await previewPositionFunctionalSet(payload());
      if (res.ok) setImpact(res.impact);
      else setError(tt(res.error.en, res.error.th));
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setPositionFunctionalSet(payload());
      if (res.ok) {
        onClose();
        onResult(res);
      } else {
        setError(tt(res.error.en, res.error.th));
      }
    });
  }

  const names = (ids: string[]) =>
    ids.map((id) => (byId.get(id) ? name(byId.get(id)!) : id)).join(", ");

  return (
    <Modal
      open={Boolean(position)}
      onClose={onClose}
      width="max-w-xl"
      title={tt(`Functional competencies — ${position?.name ?? ""}`, `สมรรถนะเฉพาะตามสายงาน — ${position?.name ?? ""}`)}
      subtitle={tt(
        "Core and managerial competencies follow the career role. Functional ones follow the position; the expected level still comes from the career role.",
        "สมรรถนะหลักและสมรรถนะการบริหารขึ้นกับบทบาทสายอาชีพ ส่วนสมรรถนะเฉพาะขึ้นกับตำแหน่ง โดยระดับที่คาดหวังยังมาจากบทบาทสายอาชีพ",
      )}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tt("Cancel", "ยกเลิก")}
          </Button>
          {impact ? (
            <Button onClick={save} disabled={!editable || busy}>
              {tt("Confirm and save", "ยืนยันและบันทึก")}
            </Button>
          ) : (
            <Button onClick={preview} disabled={!editable || busy || (!useDefault && chosen.size === 0)}>
              {tt("Review the impact", "ดูผลกระทบ")}
            </Button>
          )}
        </>
      }
    >
      {!functional.ready ? (
        <div className="mb-4">
          <Note>
            {tt(
              "Choosing functional competencies per position needs database migration 0017, which has not been applied yet. Everyone uses the default set until then.",
              "การเลือกสมรรถนะเฉพาะตามตำแหน่งต้องใช้ migration 0017 ของฐานข้อมูลซึ่งยังไม่ได้รัน ระหว่างนี้ทุกคนใช้ชุดเริ่มต้น",
            )}
          </Note>
        </div>
      ) : !canEdit ? (
        <div className="mb-4">
          <Note>
            {tt(
              "You can see this set but not change it — that needs “Manage competency framework”.",
              "คุณดูชุดนี้ได้แต่แก้ไขไม่ได้ ต้องมีสิทธิ์ “จัดการกรอบสมรรถนะ”",
            )}
          </Note>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="functional-mode"
            checked={useDefault}
            disabled={!editable}
            onChange={() => {
              setUseDefault(true);
              setImpact(null);
            }}
            className="accent-[#006bff]"
          />
          {tt(
            `Default set (${defaults.length}): ${names(defaults.map((c) => c.id))}`,
            `ชุดเริ่มต้น (${defaults.length}): ${names(defaults.map((c) => c.id))}`,
          )}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="functional-mode"
            checked={!useDefault}
            disabled={!editable}
            onChange={() => {
              setUseDefault(false);
              setImpact(null);
            }}
            className="accent-[#006bff]"
          />
          {tt("This position's own set", "ชุดเฉพาะของตำแหน่งนี้")}
        </label>
      </div>

      {!useDefault ? (
        <ul className="mt-3 grid gap-1.5 rounded-xl border border-line/70 p-3 sm:grid-cols-2">
          {functional.competencies.map((c) => (
            <li key={c.id}>
              <label className="flex items-start gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={chosen.has(c.id)}
                  disabled={!editable}
                  onChange={() => toggle(c.id)}
                  className="mt-0.5 accent-[#006bff]"
                />
                <span>
                  {name(c)}
                  {c.defaultFunctional ? (
                    <span className="ml-1 text-muted">{tt("(default)", "(ชุดเริ่มต้น)")}</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      <p
        className={cn(
          "mt-3 text-xs",
          size !== functional.briefSetSize ? "font-medium text-amber" : "text-muted",
        )}
      >
        {size !== functional.briefSetSize
          ? tt(
              `${size} selected. The brief asks for ${functional.briefSetSize} per position — you can still save.`,
              `เลือก ${size} รายการ brief กำหนด ${functional.briefSetSize} รายการต่อตำแหน่ง แต่ยังบันทึกได้`,
            )
          : tt(`${size} selected.`, `เลือก ${size} รายการ`)}
      </p>

      {impact ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
          <div className="min-w-0 space-y-1.5 leading-relaxed text-ink">
            <p>
              {tt(
                `${impact.people} active ${impact.people === 1 ? "person holds" : "people hold"} this position; ${impact.peopleChanged} of them will be assessed on something different. Their gap report, skill index, assessment progress and assigned courses are recalculated.`,
                `มีพนักงาน ${impact.people} คนในตำแหน่งนี้ ${impact.peopleChanged} คนจะถูกประเมินต่างจากเดิม รายงานส่วนต่าง ดัชนีสมรรถนะ ความคืบหน้าการประเมิน และคอร์สที่ได้รับมอบหมายจะถูกคำนวณใหม่`,
              )}
            </p>
            {impact.added.length ? (
              <p>
                {tt("Added: ", "เพิ่ม: ")}
                <span className="font-medium">{names(impact.added)}</span>
                {tt(" — counts as unscored until somebody rates it.", " — นับว่ายังไม่มีคะแนนจนกว่าจะมีผู้ให้คะแนน")}
              </p>
            ) : null}
            {impact.removed.length ? (
              <p>
                {tt("Removed: ", "นำออก: ")}
                <span className="font-medium">{names(impact.removed)}</span>
                {impact.scoresOrphaned
                  ? tt(
                      ` — ${impact.scoresOrphaned} existing score(s) this cycle are kept but stop being counted.`,
                      ` — คะแนนเดิมในรอบนี้ ${impact.scoresOrphaned} รายการยังถูกเก็บไว้แต่จะไม่ถูกนำมาคิด`,
                    )
                  : tt(" — nobody has been scored on them yet.", " — ยังไม่มีใครได้รับคะแนนในรายการนี้")}
              </p>
            ) : null}
            {!impact.added.length && !impact.removed.length ? (
              <p>{tt("Nobody's assessment changes.", "ไม่มีการเปลี่ยนแปลงการประเมินของใคร")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
