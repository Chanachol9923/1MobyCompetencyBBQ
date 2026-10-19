import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer } from "@/server/session";
import { typhoon, TYPHOON_CHAT_MODEL, typhoonConfigured } from "@/server/typhoon";

/**
 * A short quiz on one chapter, written by Typhoon from what the chapter says:
 * its text and the speech in its video. Each question carries the right
 * answer, why it is right, and (when it came from the video) the moment to
 * rewatch. A fresh set every time; it counts toward the daily AI allowance.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

const body = z.object({
  courseId: z.string().min(1).max(64),
  chapterId: z.string().min(1).max(64),
  lang: z.enum(["th", "en"]).default("th"),
  /** questions already asked in this session, so a new set does not repeat them */
  avoid: z.array(z.string().max(400)).max(30).default([]),
});

type QuizQuestionOut = {
  stem: string;
  options: string[];
  answerIndex: number;
  explain: string;
  /** seconds into the chapter video, when the answer is in the video */
  sec: number | null;
};

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

/** Pull the first JSON object out of a model reply. */
function firstJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  const raw = text.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

/** "1:05" → 65; anything else → null. */
function seconds(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Keep only well-formed questions, with the options shuffled (models like putting the answer first). */
function clean(raw: unknown, duration: number | null): QuizQuestionOut[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  const out: QuizQuestionOut[] = [];
  for (const q of list as Record<string, unknown>[]) {
    const stem = typeof q?.question === "string" ? q.question.trim() : "";
    const options = Array.isArray(q?.options)
      ? (q.options as unknown[]).filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim())
      : [];
    const answer = typeof q?.answer === "number" ? q.answer : -1;
    if (!stem || options.length < 3 || options.length > 4 || new Set(options).size !== options.length) continue;
    if (answer < 0 || answer >= options.length) continue;
    const correct = options[answer]!;
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    const sec = seconds(q.at);
    out.push({
      stem,
      options: shuffled,
      answerIndex: shuffled.indexOf(correct),
      explain: typeof q.explain === "string" ? q.explain.trim() : "",
      sec: sec != null && (duration == null || sec <= duration) ? sec : null,
    });
  }
  return out.slice(0, 3);
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.employeeId) return json(401, { error: "Sign in first." });
  if (!typhoonConfigured()) return json(503, { error: "The assistant is not switched on yet." });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Bad request." });
  const { courseId, chapterId, lang, avoid } = parsed.data;

  const chapter = await db.chapter.findFirst({
    where: { id: chapterId, courseId, course: { status: "PUBLISHED" } },
    select: {
      titleEn: true,
      titleTh: true,
      summaryEn: true,
      summaryTh: true,
      bulletsEn: true,
      bulletsTh: true,
      bodyEn: true,
      bodyTh: true,
      mediaUrl: true,
      course: { select: { titleEn: true, titleTh: true } },
    },
  });
  if (!chapter) return json(404, { error: "Chapter not found." });

  const since = new Date(Date.now() - 24 * 3600_000);
  const used = await db.aiQuestion.count({ where: { userId: viewer.userId, createdAt: { gte: since } } });
  if (used >= DAILY_LIMIT) {
    return json(429, {
      error:
        lang === "th"
          ? `วันนี้ใช้ AI ครบ ${DAILY_LIMIT} ครั้งแล้ว ลองใหม่พรุ่งนี้นะ`
          : `You've used the assistant ${DAILY_LIMIT} times today. Try again tomorrow.`,
    });
  }

  const transcript = chapter.mediaUrl
    ? await db.mediaTranscript.findUnique({
        where: { mediaUrl: chapter.mediaUrl },
        select: { status: true, durationSec: true, cues: { orderBy: { startMs: "asc" }, select: { startMs: true, text: true } } },
      })
    : null;
  const speech =
    transcript?.status === "READY" ? transcript.cues.map((c) => `[${mmss(c.startMs)}] ${c.text}`).join("\n") : "";
  // a PDF chapter: the pages the assistant has read
  const pdf = chapter.mediaUrl
    ? await db.documentText.findUnique({
        where: { fileUrl: chapter.mediaUrl },
        select: { status: true, pages: { orderBy: { page: "asc" }, select: { page: true, text: true } } },
      })
    : null;
  const pdfText =
    pdf?.status === "READY" ? pdf.pages.map((p) => `[page ${p.page}]\n${p.text}`).join("\n\n") : "";

  const material = [
    `Course: ${chapter.course.titleTh ?? ""} (${chapter.course.titleEn})`,
    `Chapter: ${chapter.titleTh ?? ""} (${chapter.titleEn})`,
    chapter.summaryTh ?? "",
    chapter.summaryEn ?? "",
    ...chapter.bulletsTh,
    ...chapter.bulletsEn,
    chapter.bodyTh ?? "",
    chapter.bodyEn ?? "",
    speech ? `Video transcript:\n${speech}` : "",
    pdfText ? `PDF:\n${pdfText}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 24_000);

  const system =
    "You write short quizzes that check whether an employee understood one chapter of a training course. " +
    "Use only the material given; never test facts it does not contain. " +
    "Write 3 multiple-choice questions, each with 4 options and exactly one correct answer. " +
    "Ask about understanding and applying the ideas (what to do in a situation, why something matters), not trivia like chapter numbers or titles. " +
    "Wrong options must be plausible but clearly wrong according to the material. Keep options short and similar in length. " +
    (lang === "th" ? "Write everything in Thai (technical terms may stay in English). " : "Write everything in English. ") +
    'Reply with JSON only: {"questions": [{"question": string, "options": [string, string, string, string], "answer": index of the correct option (0-3), ' +
    '"explain": one sentence on why it is right, "at": "m:ss" of the transcript line it comes from, or null}]}';

  const user =
    `Material:\n${material}` +
    (avoid.length ? `\n\nAsk different questions from these, already asked:\n${avoid.map((a) => `- ${a}`).join("\n")}` : "");

  const ask = async () => {
    const res = await typhoon().chat.completions.create(
      {
        model: TYPHOON_CHAT_MODEL,
        temperature: 0.7,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { timeout: 25_000, maxRetries: 0 },
    );
    const questions = clean(firstJson(res.choices[0]?.message?.content ?? ""), transcript?.durationSec ?? null);
    if (questions.length < 2) throw new Error("Too few usable questions.");
    return questions;
  };

  try {
    const questions = await ask().catch(ask);
    await db.aiQuestion
      .create({
        data: {
          userId: viewer.userId,
          courseId,
          question: `[quiz] ${chapter.titleEn}`,
          answer: questions.map((q) => q.stem).join("\n").slice(0, 8000),
        },
      })
      .catch(() => {});
    return json(200, { questions, remaining: Math.max(0, DAILY_LIMIT - used - 1) });
  } catch {
    return json(502, {
      error:
        lang === "th"
          ? "สร้างแบบทดสอบไม่สำเร็จ ลองใหม่อีกครั้ง"
          : "Couldn't write a quiz right now. Please try again.",
    });
  }
}
