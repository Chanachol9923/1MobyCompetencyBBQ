"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, TrendingUp, X } from "lucide-react";
import { Button, Modal, Pill, Progress } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PASS_MARK } from "./model";
import {
  buildCourseTest,
  scoreTest,
  type TestSource,
  type TestVariant,
} from "./testEngine";

/* -------------------------------------------------------------------- modal */

export function CourseTestModal({
  open,
  onClose,
  title,
  source,
  variant,
  onSubmit,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  /** the course title, already picked by language */
  title: string;
  source: TestSource;
  variant: TestVariant;
  /** called once, with the percentage score, the moment the paper is handed in */
  onSubmit: (score: number) => void;
  pending?: boolean;
}) {
  const { tt, lang } = useT();
  // keyed on the course id, not the object: a re-render must not regenerate the
  // paper under the learner mid-test
  const questions = useMemo(
    () => buildCourseTest(source, variant),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source.courseId, variant],
  );
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setAnswers(questions.map(() => null));
    setScore(null);
  }, [open, questions]);

  const answered = answers.filter((a) => a !== null).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  const heading =
    variant === "pre"
      ? tt("Pre-test", "แบบทดสอบก่อนเรียน")
      : tt("Post-test", "แบบทดสอบหลังเรียน");

  const submit = () => {
    const value = scoreTest(questions, answers);
    setScore(value);
    onSubmit(value);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={`${heading} — ${title}`}
      subtitle={
        score === null
          ? tt(
              `${questions.length} questions generated from this course's chapters`,
              `${questions.length} ข้อ สร้างจากบทเรียนของหลักสูตรนี้`,
            )
          : tt("Your result", "ผลการทำแบบทดสอบ")
      }
      footer={
        score === null ? (
          <>
            <Button variant="outline" onClick={onClose}>
              {tt("Cancel", "ยกเลิก")}
            </Button>
            <Button onClick={submit} disabled={!allAnswered || pending}>
              <ClipboardCheck size={16} />
              {tt("Submit answers", "ส่งคำตอบ")}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} disabled={pending}>
            {tt("Done", "เสร็จสิ้น")}
          </Button>
        )
      }
    >
      {score === null ? (
        <>
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{tt("Answered", "ตอบแล้ว")}</span>
              <span className="font-bold text-ink">
                {answered} / {questions.length}
              </span>
            </div>
            <Progress value={(answered / Math.max(1, questions.length)) * 100} />
          </div>
          <ol className="space-y-4">
            {questions.map((q, qi) => (
              <li key={q.id} className="rounded-xl border border-line/70 p-4">
                <p className="text-sm font-medium text-ink">
                  {qi + 1}. {lang === "th" ? q.stem.th : q.stem.en}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((o, oi) => {
                    const picked = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))
                        }
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                          picked
                            ? "border-brand bg-brand-tint text-ink"
                            : "border-line bg-white text-muted hover:border-line-2",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            picked
                              ? "border-brand bg-brand text-white"
                              : "border-line-2",
                          )}
                        >
                          {picked ? <Check size={10} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          {String.fromCharCode(65 + oi)}.{" "}
                          {lang === "th" ? o.th : o.en}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface p-4">
            <div>
              <p className="text-xs text-muted">{tt("Score", "คะแนน")}</p>
              <p
                className={cn(
                  "text-3xl font-bold",
                  score >= PASS_MARK ? "text-success" : "text-accent",
                )}
              >
                {score}%
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <Pill tone={score >= PASS_MARK ? "success" : "danger"}>
                {score >= PASS_MARK
                  ? tt("Passed", "ผ่านเกณฑ์")
                  : tt("Not passed", "ยังไม่ผ่านเกณฑ์")}
              </Pill>
              <p className="mt-1.5 text-xs text-muted">
                {variant === "pre"
                  ? tt(
                      "This is your baseline. Work through the chapters and take the post-test at the end.",
                      "นี่คือคะแนนตั้งต้นของคุณ เรียนให้ครบทุกบทแล้วทำแบบทดสอบหลังเรียนอีกครั้ง",
                    )
                  : score >= PASS_MARK
                    ? tt(
                        `Pass mark is ${PASS_MARK}% — your certificate has been issued.`,
                        `เกณฑ์ผ่านคือ ${PASS_MARK}% ระบบได้ออกใบรับรองให้คุณแล้ว`,
                      )
                    : tt(
                        `Pass mark is ${PASS_MARK}%. Review the chapters and retake the post-test.`,
                        `เกณฑ์ผ่านคือ ${PASS_MARK}% กรุณาทบทวนบทเรียนแล้วทำแบบทดสอบใหม่อีกครั้ง`,
                      )}
              </p>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {questions.map((q, qi) => {
              const right = answers[qi] === q.answerIndex;
              return (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-lg border border-line/70 px-3 py-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-white",
                      right ? "bg-success" : "bg-accent",
                    )}
                  >
                    {right ? <Check size={10} /> : <X size={10} />}
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-muted">
                    <span className="block font-medium text-ink">
                      {qi + 1}. {lang === "th" ? q.stem.th : q.stem.en}
                    </span>
                    {tt("Correct answer", "คำตอบที่ถูกต้อง")}:{" "}
                    {lang === "th"
                      ? q.options[q.answerIndex]!.th
                      : q.options[q.answerIndex]!.en}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------ result panel */

/**
 * The two scores side by side. `pre === null` means the learner skipped the
 * pre-test — there is no `TestResult` row for it, so the baseline is genuinely
 * unknown rather than a zero.
 */
export function TestResultPanel({
  pre,
  post,
  onRetakePost,
}: {
  pre: number | null;
  post: number | null;
  onRetakePost?: () => void;
}) {
  const { tt } = useT();
  const delta = pre !== null && post !== null ? post - pre : null;

  return (
    <div className="rounded-xl border border-line/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">
          {tt("Pre-test and post-test", "แบบทดสอบก่อนเรียนและหลังเรียน")}
        </h3>
        {post !== null ? (
          <Pill tone={post >= PASS_MARK ? "success" : "danger"}>
            {post >= PASS_MARK
              ? tt("Passed", "ผ่านเกณฑ์")
              : tt("Not passed", "ยังไม่ผ่านเกณฑ์")}
          </Pill>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ScoreTile
          label={tt("Pre-test", "ก่อนเรียน")}
          value={pre === null ? tt("Unknown", "ไม่ทราบ") : `${pre}%`}
          hint={
            pre === null
              ? tt(
                  "Baseline unknown — pre-test skipped",
                  "ไม่ทราบคะแนนตั้งต้น เนื่องจากข้ามแบบทดสอบก่อนเรียน",
                )
              : undefined
          }
          tone="muted"
        />
        <ScoreTile
          label={tt("Post-test", "หลังเรียน")}
          value={post === null ? tt("Not taken", "ยังไม่ได้ทำ") : `${post}%`}
          tone={post !== null && post >= PASS_MARK ? "success" : "ink"}
        />
        <ScoreTile
          label={tt("Improvement", "พัฒนาการ")}
          value={
            delta === null
              ? "—"
              : `${delta > 0 ? "+" : ""}${delta} ${tt("pts", "คะแนน")}`
          }
          hint={
            delta === null
              ? tt("Needs both scores", "ต้องมีคะแนนทั้งสองครั้ง")
              : undefined
          }
          tone={delta !== null && delta > 0 ? "success" : "ink"}
          icon={delta !== null && delta > 0}
        />
      </div>

      {post !== null && post < PASS_MARK && onRetakePost ? (
        <Button className="mt-4" variant="outline" onClick={onRetakePost}>
          {tt("Retake post-test", "ทำแบบทดสอบหลังเรียนอีกครั้ง")}
        </Button>
      ) : null}
    </div>
  );
}

function ScoreTile({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "ink" | "success" | "muted";
  icon?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface/70 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 inline-flex items-center gap-1 text-lg font-bold",
          tone === "success" && "text-success",
          tone === "muted" && "text-muted",
          tone === "ink" && "text-ink",
        )}
      >
        {icon ? <TrendingUp size={16} /> : null}
        {value}
      </p>
      {hint ? <p className="text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}
