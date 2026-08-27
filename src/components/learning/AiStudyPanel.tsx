"use client";

import { useMemo, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { Chapter, Course } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- message */

type QuizQuestion = {
  stem: string;
  options: string[];
  answerIndex: number;
};

type AiMessage =
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "bullets"; text: string; bullets: string[] }
  | {
      id: string;
      role: "ai";
      kind: "quiz";
      text: string;
      questions: QuizQuestion[];
    };

let seq = 0;
const nextId = () => `m${++seq}`;

/* ---------------------------------------------------------- canned answers */

const STOP = new Set([
  "the","a","an","is","are","of","to","and","or","in","on","for","with","what",
  "how","why","do","does","this","that","it","i","me","my","you","your","can",
  "should","about","chapter","tell","explain","which","when","who","be","was",
]);

function keywords(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function bestBullet(question: string, bullets: string[]) {
  const qs = keywords(question);
  if (!qs.length) {
    // Thai (and any non-latin script) has no latin keywords to score, so fall
    // back to a plain substring match on the longer tokens of the question.
    const tokens = question
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    return (
      bullets.find((b) => tokens.some((tk) => b.includes(tk))) ?? null
    );
  }
  const scored = bullets.map((bullet) => {
    const bs = new Set(keywords(bullet));
    return { bullet, score: qs.reduce((a, w) => a + (bs.has(w) ? 1 : 0), 0) };
  });
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.bullet : null;
}

type Lang = "en" | "th";

const bulletsOf = (ch: Chapter, lang: Lang) =>
  lang === "th" && ch.bulletsTh?.length ? ch.bulletsTh : ch.bullets;
const titleOf = (ch: Chapter, lang: Lang) =>
  lang === "th" ? ch.titleTh ?? ch.title : ch.title;
const summaryOf = (ch: Chapter, lang: Lang) =>
  lang === "th" ? ch.summaryTh ?? ch.summary : ch.summary;
const courseTitleOf = (c: Course, lang: Lang) =>
  lang === "th" ? c.titleTh ?? c.title : c.title;

function buildQuiz(course: Course, chapter: Chapter, lang: Lang): QuizQuestion[] {
  const others = course.chapters
    .filter((c) => c.id !== chapter.id)
    .flatMap((c) => bulletsOf(c, lang));
  const fallback =
    lang === "th"
      ? ["ข้ามการทบทวนงานเมื่อรอบการทำงานผ่านไปด้วยดี", "รอให้คนอื่นหยิบยกความเสี่ยงขึ้นมาเอง"]
      : [
          "Skips the retrospective when the sprint went well.",
          "Waits for someone else to raise the risk.",
        ];
  const pool = others.length ? others : fallback;

  const stems =
    lang === "th"
      ? [
          `บทเรียน "${titleOf(chapter, lang)}" ต้องการพฤติกรรมแบบใด`,
          `สรุปของบทนี้คือ "${summaryOf(chapter, lang)}" — ข้อใดคือแนวปฏิบัติที่ตามมา`,
          `เลือกข้อความที่เป็นของบทเรียนนี้`,
        ]
      : [
          `Which behaviour does "${titleOf(chapter, lang)}" actually ask for?`,
          `The chapter summary is "${summaryOf(chapter, lang)}" — which practice follows from it?`,
          `Pick the statement that belongs to this chapter.`,
        ];

  return bulletsOf(chapter, lang).slice(0, 3).map((correct, i) => {
    const distractors = [pool[i % pool.length]!, pool[(i + 1) % pool.length]!];
    const options = [correct, ...distractors.filter((d) => d !== correct)];
    // deterministic rotation so the answer is not always first
    const shift = i % options.length;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    return {
      stem: stems[i] ?? stems[0]!,
      options: rotated,
      answerIndex: rotated.indexOf(correct),
    };
  });
}

/* ------------------------------------------------------------------ panel */

export function AiStudyPanel({
  course,
  chapter,
}: {
  course: Course;
  chapter: Chapter;
}) {
  const { tt, lang } = useT();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const chapterNo = useMemo(
    () => course.chapters.findIndex((c) => c.id === chapter.id) + 1,
    [course.chapters, chapter.id],
  );

  const chTitle = titleOf(chapter, lang);
  const chSummary = summaryOf(chapter, lang);
  const chBullets = bulletsOf(chapter, lang);
  const labels = {
    quiz: tt("Quick Quiz!", "ควิซด่วน!"),
    summarize: tt("Summarize", "สรุปให้หน่อย"),
    askMe: tt("Ask me!", "ถามฉันสิ!"),
  };

  const push = (...msgs: AiMessage[]) =>
    setMessages((prev) => [...prev, ...msgs]);

  const quickQuiz = () => {
    push(
      { id: nextId(), role: "user", kind: "text", text: labels.quiz },
      {
        id: nextId(),
        role: "ai",
        kind: "quiz",
        text: tt(
          `Three questions on chapter ${chapterNo} — ${chTitle}. Reveal each answer when you are ready.`,
          `คำถามสามข้อจากบทที่ ${chapterNo} — ${chTitle} กดดูเฉลยได้เมื่อพร้อม`,
        ),
        questions: buildQuiz(course, chapter, lang),
      },
    );
  };

  const summarize = () => {
    push(
      { id: nextId(), role: "user", kind: "text", text: labels.summarize },
      {
        id: nextId(),
        role: "ai",
        kind: "bullets",
        text: tt(
          `Chapter ${chapterNo} — ${chTitle}: ${chSummary}`,
          `บทที่ ${chapterNo} — ${chTitle}: ${chSummary}`,
        ),
        bullets: chBullets,
      },
    );
  };

  const askMe = () => {
    push(
      { id: nextId(), role: "user", kind: "text", text: labels.askMe },
      {
        id: nextId(),
        role: "ai",
        kind: "bullets",
        text: tt(
          `Ask me anything about "${chTitle}". I answer from the chapter's behavioural indicators — for example:`,
          `ถามอะไรก็ได้เกี่ยวกับ "${chTitle}" ฉันตอบจากตัวชี้วัดพฤติกรรมของบทนี้ เช่น`,
        ),
        bullets: chBullets
          .slice(0, 2)
          .map((b) =>
            tt(
              `What does "${b.replace(/\.$/, "")}" look like day to day?`,
              `"${b.replace(/\.$/, "")}" ในการทำงานประจำวันหน้าตาเป็นอย่างไร`,
            ),
          ),
      },
    );
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const hit = bestBullet(text, chBullets);
    push({ id: nextId(), role: "user", kind: "text", text });
    if (hit) {
      push({
        id: nextId(),
        role: "ai",
        kind: "bullets",
        text: tt(
          `Chapter ${chapterNo} of ${courseTitleOf(course, lang)} covers that directly:`,
          `บทที่ ${chapterNo} ของ ${courseTitleOf(course, lang)} พูดถึงเรื่องนี้โดยตรง`,
        ),
        bullets: [hit],
      });
    } else {
      push({
        id: nextId(),
        role: "ai",
        kind: "bullets",
        text: tt(
          `I could not match that to this chapter. Here is what "${chTitle}" does cover — ${chSummary}`,
          `ฉันจับคู่คำถามนี้กับบทเรียนไม่ได้ สิ่งที่ "${chTitle}" ครอบคลุมคือ — ${chSummary}`,
        ),
        bullets: chBullets,
      });
    }
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  return (
    <section className="rounded-2xl bg-surface p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-amber text-white">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{tt("Ask AI", "ถาม AI")}</h2>
          <p className="text-xs text-muted">
            {tt(
              "Scripted demo assistant — answers are generated locally from this chapter's content. No network calls.",
              "ผู้ช่วยสาธิตแบบสคริปต์ — คำตอบถูกสร้างจากเนื้อหาของบทเรียนนี้ในเครื่องของคุณ ไม่มีการเรียกใช้งานผ่านเครือข่าย",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={quickQuiz}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95 active:scale-[.98]"
        >
          {labels.quiz}
        </button>
        <button
          type="button"
          onClick={summarize}
          className="rounded-full bg-amber px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95 active:scale-[.98]"
        >
          {labels.summarize}
        </button>
        <button
          type="button"
          onClick={askMe}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[.98]"
        >
          {labels.askMe}
        </button>
      </div>

      <div
        ref={listRef}
        className="scroll-thin mt-4 max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {tt(
              `Pick a quick action or type a question about chapter ${chapterNo}.`,
              `เลือกปุ่มลัด หรือพิมพ์คำถามเกี่ยวกับบทที่ ${chapterNo}`,
            )}
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <form
        className="mt-4 flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tt(`Ask about "${chTitle}"…`, `ถามเกี่ยวกับ "${chTitle}"…`)}
          aria-label={tt("Ask the study assistant", "ถามผู้ช่วยการเรียนรู้")}
          className="h-11 w-full rounded-full border border-line bg-white px-4 text-sm text-ink outline-none placeholder:text-line-2 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={tt("Send", "ส่ง")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-amber text-white transition hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

/* ---------------------------------------------------------------- bubbles */

function MessageBubble({ message }: { message: AiMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3">
        <p className="text-sm text-ink">{message.text}</p>
        {message.kind === "bullets" ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-light text-muted">
            {message.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}
        {message.kind === "quiz" ? (
          <div className="mt-3 space-y-3">
            {message.questions.map((q, i) => (
              <QuizItem key={i} index={i + 1} question={q} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuizItem({
  index,
  question,
}: {
  index: number;
  question: QuizQuestion;
}) {
  const { tt } = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-sm font-medium text-ink">
        Q{index}. {question.stem}
      </p>
      <div className="mt-2 space-y-1.5">
        {question.options.map((o, i) => {
          const correct = revealed && i === question.answerIndex;
          const wrong = revealed && picked === i && i !== question.answerIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => !revealed && setPicked(i)}
              className={cn(
                "block w-full rounded-md border px-3 py-2 text-left text-xs transition-colors",
                correct && "border-success bg-success/10 text-ink",
                wrong && "border-accent bg-accent/10 text-ink",
                !correct && !wrong && picked === i && "border-brand bg-brand-tint",
                !correct && !wrong && picked !== i && "border-line bg-white text-muted hover:border-line-2",
              )}
            >
              {String.fromCharCode(65 + i)}. {o}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-2 text-xs font-medium text-brand hover:underline"
      >
        {revealed ? tt("Hide answer", "ซ่อนเฉลย") : tt("Reveal answer", "ดูเฉลย")}
      </button>
      {revealed ? (
        <p className="mt-1 text-xs text-muted">
          {tt("Correct", "คำตอบที่ถูก")}: {String.fromCharCode(65 + question.answerIndex)} —{" "}
          {question.options[question.answerIndex]}
        </p>
      ) : null}
    </div>
  );
}
