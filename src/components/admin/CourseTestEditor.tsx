"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { IconAction } from "@/components/admin/shared";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  draftCourseQuestionsWithAi,
  getCourseQuestionBank,
  saveCourseQuestionBank,
  type BankQuestion,
} from "@/server/course-questions-admin";
import type { ActionResult } from "@/components/admin/content-types";

const blankQuestion = (): BankQuestion => ({
  stemEn: "",
  stemTh: "",
  options: [
    { en: "", th: "" },
    { en: "", th: "" },
    { en: "", th: "" },
    { en: "", th: "" },
  ],
  answerIndex: 0,
  explainEn: "",
  explainTh: "",
});

/**
 * "แบบทดสอบ" — the pre/post-test bank of one course.
 *
 * Both tests draw from these questions in their own order; learners never see
 * which option is right until they hand the paper in, and the server grades
 * it. "Draft with AI" asks Typhoon for a set written from the whole course,
 * which lands here for the administrator to check — nothing is saved until
 * Save. An empty bank keeps the paper generated from the chapters.
 */
export function CourseTestEditor({
  course,
  onClose,
  onSaved,
}: {
  course: { id: string; title: string };
  onClose: () => void;
  onSaved: (result: ActionResult) => void;
}) {
  const { tt } = useT();
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    startTransition(async () => {
      const res = await getCourseQuestionBank({ courseId: course.id });
      if (!live) return;
      if (!res.ok) {
        setError(tt(res.error.en, res.error.th));
        setQuestions([]);
        return;
      }
      setAvailable(res.data.available);
      setAiAvailable(res.data.aiAvailable);
      setQuestions(res.data.questions);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  const update = (i: number, patch: Partial<BankQuestion>) =>
    setQuestions((qs) => (qs ?? []).map((q, k) => (k === i ? { ...q, ...patch } : q)));

  const setOption = (i: number, oi: number, lang: "en" | "th", value: string) =>
    setQuestions((qs) =>
      (qs ?? []).map((q, k) =>
        k === i
          ? {
              ...q,
              options: q.options.map((o, n) => (n === oi ? { ...o, [lang]: value } : o)),
            }
          : q,
      ),
    );

  const draft = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await draftCourseQuestionsWithAi({ courseId: course.id });
      if (!res.ok) {
        setError(tt(res.error.en, res.error.th));
        return;
      }
      setQuestions((qs) => [...(qs ?? []), ...res.data.questions]);
      setNotice(
        tt(
          `${res.data.questions.length} drafted questions added below — check every one before saving.`,
          `เพิ่มข้อสอบที่ AI ร่าง ${res.data.questions.length} ข้อไว้ด้านล่างแล้ว กรุณาตรวจทุกข้อก่อนบันทึก`,
        ),
      );
    });
  };

  const save = () => {
    if (!questions) return;
    setError(null);
    startTransition(async () => {
      const res = await saveCourseQuestionBank({ courseId: course.id, questions });
      if (!res.ok) {
        setError(tt(res.error.en, res.error.th));
        return;
      }
      onSaved({
        ok: true,
        message: {
          en: `Saved ${res.data.count} test questions for ${course.title}.`,
          th: `บันทึกข้อสอบ ${res.data.count} ข้อของ ${course.title} แล้ว`,
        },
      });
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title={`${tt("Pre/post-test", "แบบทดสอบก่อน/หลังเรียน")} — ${course.title}`}
      subtitle={tt(
        "Both tests use these questions, each in its own order. With no questions, the test is generated from the chapters.",
        "แบบทดสอบก่อนและหลังเรียนใช้คำถามชุดนี้ สลับลำดับต่างกัน หากไม่มีคำถาม ระบบจะสร้างแบบทดสอบจากบทเรียนให้",
      )}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tt("Cancel", "ยกเลิก")}
          </Button>
          <Button onClick={save} disabled={busy || !available || questions === null}>
            {tt("Save questions", "บันทึกข้อสอบ")}
          </Button>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg border border-brand/30 bg-brand-tint px-3 py-2 text-xs text-ink">
          {notice}
        </p>
      ) : null}
      {!available ? (
        <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          {tt(
            "The question bank is not set up in the database yet (migration 0015). Until then every course uses the test generated from its chapters.",
            "ฐานข้อมูลยังไม่มีคลังข้อสอบ (ต้องรัน migration 0015) ระหว่างนี้ทุกหลักสูตรใช้แบบทดสอบที่สร้างจากบทเรียน",
          )}
        </p>
      ) : null}

      {questions === null ? (
        <p className="py-10 text-center text-sm text-muted">
          {tt("Loading questions…", "กำลังโหลดคำถาม…")}
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-line/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  {tt(`Question ${i + 1}`, `ข้อ ${i + 1}`)}
                </p>
                <IconAction
                  tone="danger"
                  aria-label={tt(`Remove question ${i + 1}`, `ลบข้อ ${i + 1}`)}
                  onClick={() => setQuestions((qs) => (qs ?? []).filter((_, k) => k !== i))}
                >
                  <Trash2 size={14} />
                </IconAction>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${tt("Question (English)", "คำถาม (อังกฤษ)")} *`}>
                  <Input value={q.stemEn} onChange={(e) => update(i, { stemEn: e.target.value })} />
                </Field>
                <Field label={tt("Question (Thai)", "คำถาม (ไทย)")}>
                  <Input value={q.stemTh} onChange={(e) => update(i, { stemTh: e.target.value })} />
                </Field>
              </div>
              <fieldset className="mt-3 space-y-2">
                <legend className="mb-1 text-xs text-muted">
                  {tt("Options — pick the correct one", "ตัวเลือก — เลือกข้อที่ถูก")}
                </legend>
                {q.options.map((o, oi) => (
                  <div
                    key={oi}
                    className={cn(
                      "grid items-center gap-2 rounded-lg border px-2 py-2 sm:grid-cols-[auto_1fr_1fr]",
                      q.answerIndex === oi ? "border-success/60 bg-success/5" : "border-line",
                    )}
                  >
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="radio"
                        name={`answer-${i}`}
                        checked={q.answerIndex === oi}
                        onChange={() => update(i, { answerIndex: oi })}
                      />
                      {String.fromCharCode(65 + oi)}
                    </label>
                    <Input
                      value={o.en}
                      placeholder={tt("English", "อังกฤษ")}
                      aria-label={tt(`Option ${oi + 1} in English`, `ตัวเลือก ${oi + 1} ภาษาอังกฤษ`)}
                      onChange={(e) => setOption(i, oi, "en", e.target.value)}
                    />
                    <Input
                      value={o.th}
                      placeholder={tt("Thai", "ไทย")}
                      aria-label={tt(`Option ${oi + 1} in Thai`, `ตัวเลือก ${oi + 1} ภาษาไทย`)}
                      onChange={(e) => setOption(i, oi, "th", e.target.value)}
                    />
                  </div>
                ))}
              </fieldset>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label={tt("Why it is right (English)", "เหตุผลที่ถูก (อังกฤษ)")}>
                  <Input value={q.explainEn} onChange={(e) => update(i, { explainEn: e.target.value })} />
                </Field>
                <Field label={tt("Why it is right (Thai)", "เหตุผลที่ถูก (ไทย)")}>
                  <Input value={q.explainTh} onChange={(e) => update(i, { explainTh: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}

          {questions.length === 0 ? (
            <p className="rounded-lg bg-surface px-3 py-6 text-center text-xs text-muted">
              {tt(
                "No questions yet — learners get the test generated from the chapters.",
                "ยังไม่มีข้อสอบ ผู้เรียนจะได้แบบทดสอบที่สร้างจากบทเรียน",
              )}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || !available || questions.length >= 50}
              onClick={() => setQuestions((qs) => [...(qs ?? []), blankQuestion()])}
            >
              <Plus size={15} />
              {tt("Add question", "เพิ่มข้อสอบ")}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !available || !aiAvailable}
              title={
                aiAvailable
                  ? undefined
                  : tt("The AI assistant is not switched on.", "ยังไม่ได้เปิดใช้ผู้ช่วย AI")
              }
              onClick={draft}
            >
              <Sparkles size={15} className="text-brand" />
              {busy
                ? tt("Working…", "กำลังทำงาน…")
                : tt("Draft with AI", "ให้ AI ร่างข้อสอบ")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
