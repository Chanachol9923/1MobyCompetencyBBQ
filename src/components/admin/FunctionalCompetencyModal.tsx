"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import type { ActionResult } from "@/components/admin/content-types";
import { createFunctionalCompetency } from "@/server/functional-sets";
import { useT } from "@/lib/i18n";

type LevelDraft = { score: number; descEn: string; descTh: string };

/**
 * A starting point for the four level descriptions, in the rating scale's own
 * terms. "{name}" is replaced with the competency's name as it is typed until
 * the administrator edits a description themselves.
 */
const TEMPLATE: LevelDraft[] = [
  {
    score: 4,
    descEn: "Applies {name} well beyond what the role requires, improves how the team does it and coaches others — a model to follow.",
    descTh: "ใช้ {name} ได้เกินกว่าที่บทบาทกำหนดอย่างมาก ปรับปรุงวิธีทำงานของทีม และสอนผู้อื่นได้ เป็นต้นแบบได้",
  },
  {
    score: 3,
    descEn: "Applies {name} to the standard the role requires, consistently and without supervision.",
    descTh: "ใช้ {name} ได้ตามมาตรฐานที่บทบาทกำหนด อย่างสม่ำเสมอโดยไม่ต้องมีผู้กำกับดูแล",
  },
  {
    score: 2,
    descEn: "Applies {name} below the standard in some parts and still needs guidance to deliver.",
    descTh: "ใช้ {name} ได้ต่ำกว่ามาตรฐานในบางส่วน และยังต้องได้รับคำแนะนำเพื่อให้งานสำเร็จ",
  },
  {
    score: 1,
    descEn: "Applies {name} well below the standard; needs urgent development.",
    descTh: "ใช้ {name} ได้ต่ำกว่ามาตรฐานอย่างมาก ต้องได้รับการพัฒนาเร่งด่วน",
  },
];

const fill = (text: string, name: string) => text.replaceAll("{name}", name || "…");

/**
 * Create a FUNCTIONAL competency. It starts in no position's set, so nobody
 * is assessed on it until a position chooses it in Staff records → Position.
 */
export function FunctionalCompetencyModal({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { tt } = useT();
  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [definitionEn, setDefinitionEn] = useState("");
  const [definitionTh, setDefinitionTh] = useState("");
  const [levels, setLevels] = useState<LevelDraft[]>(TEMPLATE);
  /** descriptions the administrator has typed into, which the template no longer fills */
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setNameEn("");
    setNameTh("");
    setDefinitionEn("");
    setDefinitionTh("");
    setLevels(TEMPLATE);
    setTouched(new Set());
    setError(null);
  }, [open]);

  // what is shown and saved: the template filled with the name, or what was typed
  const resolved = levels.map((l, i) => ({
    score: l.score,
    descEn: touched.has(`${i}en`) ? l.descEn : fill(TEMPLATE[i]!.descEn, nameEn.trim()),
    descTh: touched.has(`${i}th`) ? l.descTh : fill(TEMPLATE[i]!.descTh, nameTh.trim() || nameEn.trim()),
  }));

  function setLevel(i: number, lang: "en" | "th", value: string) {
    setTouched((s) => new Set(s).add(`${i}${lang}`));
    setLevels((ls) =>
      ls.map((l, j) => (j === i ? { ...l, [lang === "en" ? "descEn" : "descTh"]: value } : l)),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createFunctionalCompetency({
        nameEn,
        nameTh,
        definitionEn,
        definitionTh,
        levels: resolved,
      });
      if (res.ok) {
        onClose();
        onResult(res);
      } else {
        setError(tt(res.error.en, res.error.th));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={tt("New functional competency", "สร้างสมรรถนะเฉพาะตามสายงาน")}
      subtitle={tt(
        "Nobody is assessed on it until a position chooses it (Staff records → Position). Every career role assessed on functional competencies expects level 3; change it in the matrix.",
        "ยังไม่มีใครถูกประเมินจนกว่าจะเลือกให้ตำแหน่ง (ข้อมูลพนักงาน → ตำแหน่ง) ทุกบทบาทที่ประเมินสมรรถนะเฉพาะจะคาดหวังระดับ 3 แก้ไขได้ในตาราง",
      )}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tt("Cancel", "ยกเลิก")}
          </Button>
          <Button onClick={save} disabled={busy || !nameEn.trim()}>
            {tt("Create", "สร้าง")}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tt("Name (English) *", "ชื่อ (อังกฤษ) *")}>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={160} />
        </Field>
        <Field label={tt("Name (Thai)", "ชื่อ (ไทย)")}>
          <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)} maxLength={160} />
        </Field>
        <Field label={tt("Definition (English)", "คำจำกัดความ (อังกฤษ)")}>
          <Textarea rows={3} value={definitionEn} onChange={(e) => setDefinitionEn(e.target.value)} />
        </Field>
        <Field label={tt("Definition (Thai)", "คำจำกัดความ (ไทย)")}>
          <Textarea rows={3} value={definitionTh} onChange={(e) => setDefinitionTh(e.target.value)} />
        </Field>
      </div>

      <h4 className="mt-5 text-sm font-bold text-ink">
        {tt("What each level looks like", "ลักษณะของแต่ละระดับ")}
      </h4>
      <p className="mt-0.5 text-xs text-muted">
        {tt(
          "Filled from a template — edit them to describe the real behaviour.",
          "เติมจากแม่แบบให้แล้ว แก้ไขให้ตรงกับพฤติกรรมจริงได้",
        )}
      </p>
      <div className="mt-3 grid gap-3">
        {resolved.map((l, i) => (
          <div key={l.score} className="grid gap-2 rounded-xl border border-line/70 p-3 sm:grid-cols-2">
            <Field label={tt(`Level ${l.score} (English)`, `ระดับ ${l.score} (อังกฤษ)`)}>
              <Textarea rows={2} value={l.descEn} onChange={(e) => setLevel(i, "en", e.target.value)} />
            </Field>
            <Field label={tt(`Level ${l.score} (Thai)`, `ระดับ ${l.score} (ไทย)`)}>
              <Textarea rows={2} value={l.descTh} onChange={(e) => setLevel(i, "th", e.target.value)} />
            </Field>
          </div>
        ))}
      </div>
    </Modal>
  );
}
