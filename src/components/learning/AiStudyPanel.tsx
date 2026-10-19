"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, PlayCircle, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
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
  /** why the answer is right (AI quizzes) */
  explain?: string;
  /** where in the chapter video the answer is */
  sec?: number | null;
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
      /** being written by the AI */
      loading?: boolean;
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
  const [remaining, setRemaining] = useState<number | null>(null);
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

  const scrollDown = () =>
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });

  /** questions already asked, so "another set" asks new ones */
  const asked = useRef<string[]>([]);
  const [quizBusy, setQuizBusy] = useState(false);

  const quickQuiz = async () => {
    if (quizBusy) return;
    const id = nextId();
    const intro = tt(
      `Three questions on chapter ${chapterNo} — ${chTitle}. Pick an answer to check it.`,
      `คำถามสามข้อจากบทที่ ${chapterNo} — ${chTitle} เลือกคำตอบเพื่อตรวจได้ทันที`,
    );
    push(
      { id: nextId(), role: "user", kind: "text", text: labels.quiz },
      { id, role: "ai", kind: "quiz", text: intro, questions: [], loading: true },
    );
    scrollDown();
    setQuizBusy(true);
    const settle = (patch: Partial<Extract<AiMessage, { kind: "quiz" }>> | null, error?: string) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== id
            ? m
            : patch
              ? ({ ...m, ...patch, loading: false } as AiMessage)
              : { id, role: "ai", kind: "text", text: error ?? tt("Something went wrong.", "เกิดข้อผิดพลาด") },
        ),
      );
    try {
      const res = await fetch("/api/learn/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: course.courseId, chapterId: chapter.id, lang, avoid: asked.current.slice(-12) }),
      });
      if (res.status === 503) {
        // the assistant is not switched on: a quiz from the chapter's own points
        const questions = buildQuiz(course, chapter, lang);
        if (questions.length) settle({ questions });
        else settle(null, tt("This chapter has no quiz yet.", "บทนี้ยังไม่มีแบบทดสอบ"));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        questions?: QuizQuestion[];
        remaining?: number;
        error?: string;
      };
      if (!res.ok || !data.questions?.length) {
        settle(null, data.error);
        return;
      }
      asked.current.push(...data.questions.map((q) => q.stem));
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      settle({ questions: data.questions });
    } catch {
      settle(null, tt("The assistant could not be reached. Try again.", "ติดต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้ง"));
    } finally {
      setQuizBusy(false);
      scrollDown();
    }
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
          onClick={() => void quickQuiz()}
          disabled={quizBusy}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95 active:scale-[.98] disabled:opacity-60"
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
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              chapterId={chapter.id}
              onAnotherQuiz={quizBusy ? undefined : () => void quickQuiz()}
            />
          ))
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

function MessageBubble({
  message,
  chapterId,
  onAnotherQuiz,
}: {
  message: AiMessage;
  chapterId: string;
  onAnotherQuiz?: () => void;
}) {
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
          message.loading ? (
            <Writing />
          ) : (
            <Quiz questions={message.questions} chapterId={chapterId} onAnother={onAnotherQuiz} />
          )
        ) : null}
      </div>
    </div>
  );
}

function Writing() {
  const { tt } = useT();
  return (
    <p className="mt-2 flex items-center gap-1.5 py-1 text-sm text-muted">
      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-accent" />
      <span className="ml-1">{tt("Writing questions from this chapter…", "กำลังออกข้อสอบจากเนื้อหาบทนี้…")}</span>
    </p>
  );
}

function Quiz({
  questions,
  chapterId,
  onAnother,
}: {
  questions: QuizQuestion[];
  chapterId: string;
  onAnother?: () => void;
}) {
  const { tt } = useT();
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));
  const answered = picks.filter((p) => p !== null).length;
  const score = picks.filter((p, i) => p === questions[i]?.answerIndex).length;
  const done = answered === questions.length;

  return (
    <div className="mt-3 space-y-3">
      {questions.map((q, i) => (
        <QuizItem
          key={i}
          index={i + 1}
          question={q}
          picked={picks[i] ?? null}
          chapterId={chapterId}
          onPick={(o) => setPicks((p) => p.map((x, k) => (k === i && x === null ? o : x)))}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className={cn("text-sm", done ? "font-bold text-ink" : "text-muted")}>
          {done
            ? score === questions.length
              ? tt(`All ${score} right — well done!`, `ถูกครบ ${score} ข้อ เยี่ยมมาก!`)
              : tt(`${score} of ${questions.length} right`, `ถูก ${score} จาก ${questions.length} ข้อ`)
            : tt(`${answered} of ${questions.length} answered`, `ตอบแล้ว ${answered} จาก ${questions.length} ข้อ`)}
        </p>
        {done && onAnother ? (
          <button
            type="button"
            onClick={onAnother}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-ink transition hover:border-brand hover:text-brand"
          >
            <RotateCcw size={12} /> {tt("Another set", "ทำชุดใหม่")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function QuizItem({
  index,
  question,
  picked,
  chapterId,
  onPick,
}: {
  index: number;
  question: QuizQuestion;
  picked: number | null;
  chapterId: string;
  onPick: (option: number) => void;
}) {
  const { tt } = useT();
  const answered = picked !== null;
  const right = picked === question.answerIndex;
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-sm font-medium text-ink">
        {index}. {question.stem}
      </p>
      <div className="mt-2 space-y-1.5">
        {question.options.map((o, i) => {
          const isAnswer = answered && i === question.answerIndex;
          const isWrongPick = answered && picked === i && !right;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => onPick(i)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                isAnswer && "border-success bg-success/10 text-ink",
                isWrongPick && "border-accent bg-accent/10 text-ink",
                !isAnswer && !isWrongPick && answered && "border-line bg-white text-muted opacity-70",
                !answered && "border-line bg-white text-ink hover:border-brand hover:bg-brand-tint",
              )}
            >
              <span className="shrink-0 font-bold">{String.fromCharCode(65 + i)}.</span>
              <span className="min-w-0 flex-1">{o}</span>
              {isAnswer ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : null}
              {isWrongPick ? <XCircle size={16} className="mt-0.5 shrink-0 text-accent" /> : null}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="mt-2 text-xs leading-relaxed">
          <p className={cn("font-bold", right ? "text-success" : "text-accent")}>
            {right
              ? tt("Correct!", "ถูกต้อง!")
              : tt(
                  `Not quite — the answer is ${String.fromCharCode(65 + question.answerIndex)}.`,
                  `ยังไม่ถูก — คำตอบคือข้อ ${String.fromCharCode(65 + question.answerIndex)}`,
                )}
          </p>
          {question.explain ? <p className="mt-0.5 text-muted">{question.explain}</p> : null}
          {question.sec != null ? (
            <button
              type="button"
              onClick={() => seekTo(chapterId, question.sec!)}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
            >
              <PlayCircle size={12} /> {tt(`Rewatch at ${clock(question.sec)}`, `ดูช่วงนี้อีกครั้ง ${clock(question.sec)}`)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- answers */

/** **bold** in an answer is shown bold, not with asterisks. */
function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((t, i) =>
    t.startsWith("**") && t.endsWith("**") && t.length > 4 ? (
      <strong key={i} className="font-bold">
        {t.slice(2, -2)}
      </strong>
    ) : (
      t
    ),
  );
}

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
        if (!m) return <span key={i}>{withBold(part)}</span>;
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
