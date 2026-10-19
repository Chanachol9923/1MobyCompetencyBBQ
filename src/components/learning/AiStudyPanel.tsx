"use client";

import { useMemo, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { pick } from "./model";
import { seekTo } from "./lesson-seek";
import type { PlayerChapter, PlayerView } from "@/server/learning";

/** The assistant only ever reads the chapter rows it was handed. */
type Chapter = PlayerChapter;
type Course = Pick<PlayerView, "courseId" | "titleEn" | "titleTh" | "chapters">;

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
    }
  | {
      id: string;
      role: "ai";
      kind: "answer";
      /** streamed in as it is written */
      text: string;
      sources: AnswerSource[];
      streaming: boolean;
    };

/** A passage the answer may cite as [S1], [S2]... */
type AnswerSource = {
  id: string;
  chapterId: string;
  chapterNo: number;
  chapterTitle: string;
  /** seconds into the chapter video; null for the chapter's written text */
  sec: number | null;
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
  lang === "th" && ch.bulletsTh.length ? ch.bulletsTh : ch.bulletsEn;
const titleOf = (ch: Chapter, lang: Lang) => pick(lang, ch.titleEn, ch.titleTh);
const summaryOf = (ch: Chapter, lang: Lang) =>
  pick(lang, ch.summaryEn ?? ch.titleEn, ch.summaryTh);
const courseTitleOf = (c: Course, lang: Lang) => pick(lang, c.titleEn, c.titleTh);

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
    quiz: tt("Quick quiz", "แบบทดสอบสั้น"),
    summarize: tt("Summarize", "สรุปเนื้อหา"),
    askMe: tt("Ask me", "ถามได้เลย"),
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
    const t = chapter.transcript;
    const aiSummary = t ? (lang === "th" ? (t.summaryTh ?? t.summaryEn) : (t.summaryEn ?? t.summaryTh)) : null;
    if (t && aiSummary) {
      const points =
        lang === "th" && t.keyPointsTh.length ? t.keyPointsTh : t.keyPointsEn.length ? t.keyPointsEn : t.keyPointsTh;
      push(
        { id: nextId(), role: "user", kind: "text", text: labels.summarize },
        {
          id: nextId(),
          role: "ai",
          kind: "bullets",
          text: tt(`Summary of the video in chapter ${chapterNo}: ${aiSummary}`, `สรุปจากวิดีโอบทที่ ${chapterNo}: ${aiSummary}`),
          bullets: points,
        },
      );
      return;
    }
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

  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const scrollDown = () =>
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });

  const update = (id: string, patch: Partial<Extract<AiMessage, { kind: "answer" }>>) =>
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === "answer" ? { ...m, ...patch } : m)));

  /** Ask the real assistant; false when it is not switched on. */
  const askAi = async (question: string): Promise<boolean> => {
    const history = messages
      .filter((m) => m.kind === "text" || m.kind === "answer")
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
    const id = nextId();
    setBusy(true);
    try {
      const res = await fetch("/api/learn/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: course.courseId, chapterId: chapter.id, question, lang, history }),
      });
      if (res.status === 503) return false;
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        push({ id, role: "ai", kind: "text", text: msg || tt("Something went wrong.", "เกิดข้อผิดพลาด") });
        return true;
      }
      push({ id, role: "ai", kind: "answer", text: "", sources: [], streaming: true });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotMeta = false;
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!gotMeta) {
          const nl = buffer.indexOf("\n");
          if (nl < 0) continue;
          try {
            const meta = JSON.parse(buffer.slice(0, nl)) as { sources: AnswerSource[]; remaining: number };
            update(id, { sources: meta.sources });
            setRemaining(meta.remaining);
          } catch {
            /* no sources: the answer still shows */
          }
          gotMeta = true;
          buffer = buffer.slice(nl + 1);
        }
        answer += buffer;
        buffer = "";
        update(id, { text: answer });
        scrollDown();
      }
      update(id, { streaming: false });
      return true;
    } catch {
      push({ id, role: "ai", kind: "text", text: tt("The assistant could not be reached. Try again.", "ติดต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้ง") });
      return true;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    push({ id: nextId(), role: "user", kind: "text", text });
    scrollDown();
    if (await askAi(text)) return;

    // the assistant is not switched on: answer from the chapter's own points
    const hit = bestBullet(text, chBullets);
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
              "Answers come from this course's videos and text, with links to the exact moment. AI can make mistakes.",
              "ตอบจากวิดีโอและเนื้อหาของคอร์สนี้ พร้อมลิงก์ไปยังช่วงเวลาที่พูดถึง — AI อาจผิดพลาดได้",
            )}
            {remaining !== null ? (
              <span className="ml-1 text-line-2">
                · {tt(`${remaining} questions left today`, `เหลือ ${remaining} คำถามวันนี้`)}
              </span>
            ) : null}
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
          disabled={!draft.trim() || busy}
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
        {message.kind === "answer" ? (
          <AnswerText message={message} />
        ) : (
          <p className="text-sm text-ink">{message.text}</p>
        )}
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

/* -------------------------------------------------------------- answers */

/** The answer as it streams, with each [S2] turned into a jump to its source. */
function AnswerText({ message }: { message: Extract<AiMessage, { kind: "answer" }> }) {
  const { tt } = useT();
  const byId = new Map(message.sources.map((s) => [s.id, s]));
  const parts = message.text.split(/(\[S\d+\])/g);
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  if (!message.text && message.streaming) {
    return (
      <p className="flex items-center gap-1.5 py-1 text-sm text-muted">
        <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.2s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-brand" />
        <span className="ml-1">{tt("Reading the course…", "กำลังอ่านเนื้อหาคอร์ส…")}</span>
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
      {parts.map((part, i) => {
        const m = /^\[(S\d+)\]$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const src = byId.get(m[1]!);
        if (!src) return null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => seekTo(src.chapterId, src.sec ?? -1)}
            title={src.chapterTitle}
            className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 align-baseline text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
          >
            {tt(`Ch ${src.chapterNo}`, `บทที่ ${src.chapterNo}`)}
            {src.sec != null ? ` · ${clock(src.sec)}` : ""}
          </button>
        );
      })}
      {message.streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-middle" /> : null}
    </p>
  );
}
