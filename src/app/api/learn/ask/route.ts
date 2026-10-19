import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer } from "@/server/session";
import { typhoon, TYPHOON_CHAT_MODEL, typhoonConfigured } from "@/server/typhoon";
import { analyseQuestion, coursePassages, rank, relatedCourses, sourcesAnswer, type Passage } from "@/server/study-ai";

/**
 * The study assistant's answers (retrieval-augmented).
 *
 * The question is widened into Thai and English search terms, the course's
 * passages — chapter text and the speech in its videos — are ranked, and
 * Typhoon answers from the best few only, citing them as [S1], [S2]… The reply
 * streams; its first line is the list of sources as JSON, so the page can turn
 * each citation into a link that jumps to that moment in the video.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

const body = z.object({
  courseId: z.string().min(1).max(64),
  chapterId: z.string().max(64).optional(),
  question: z.string().trim().min(2).max(800),
  lang: z.enum(["th", "en"]).default("th"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(8)
    .default([]),
});

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const text = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.employeeId) return text(401, "Sign in first.");
  if (!typhoonConfigured()) return text(503, "The assistant is not switched on yet.");

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text(400, "Bad request.");
  const { courseId, chapterId, question, lang, history } = parsed.data;

  const course = await db.course.findFirst({
    where: { id: courseId, status: "PUBLISHED" },
    select: { id: true, titleEn: true, titleTh: true },
  });
  if (!course) return text(404, "Course not found.");

  const since = new Date(Date.now() - 24 * 3600_000);
  const used = await db.aiQuestion.count({ where: { userId: viewer.userId, createdAt: { gte: since } } });
  if (used >= DAILY_LIMIT) {
    return text(
      429,
      lang === "th"
        ? `วันนี้ถามครบ ${DAILY_LIMIT} คำถามแล้ว ลองใหม่พรุ่งนี้นะ`
        : `You've asked ${DAILY_LIMIT} questions today. Try again tomorrow.`,
    );
  }

  const courseTitle = lang === "th" ? (course.titleTh ?? course.titleEn) : course.titleEn;
  const [all, { terms, companySpecific }] = await Promise.all([
    coursePassages(course.id, lang),
    analyseQuestion(question, courseTitle),
  ]);
  let sources: Passage[] = rank(all, terms, 6);
  // nothing matched: answer from the chapter being studied, so the reply is still grounded
  if (!sources.length) {
    sources = all
      .filter((p) => p.chapterId === chapterId)
      .slice(0, 4)
      .map((p, i) => ({ ...p, id: `S${i + 1}` }));
  }
  // other courses that may cover it, offered when this one does not
  const related = await relatedCourses(course.id, terms, lang);

  const where = (s: Passage) =>
    s.documentId
      ? `${lang === "th" ? "เอกสาร" : "Document"}: ${s.chapterTitle} · ${lang === "th" ? "หน้า" : "page"} ${s.page}`
      : `${lang === "th" ? "บทที่" : "Chapter"} ${s.chapterNo}: ${s.chapterTitle}` +
        (s.sec != null ? ` · ${mmss(s.sec)}` : "") +
        (s.page != null ? ` · ${lang === "th" ? "หน้า" : "page"} ${s.page}` : "");
  const sourceText = sources.map((s) => `[${s.id}] (${where(s)})\n${s.text.slice(0, 1800)}`).join("\n\n");
  const relatedText = related.length
    ? `\n\nOther 1Moby courses that may cover it:\n${related.map((r) => `- ${r.title}`).join("\n")}`
    : "";

  const system =
    `You are the study assistant for the course "${courseTitle}" at 1Moby. ` +
    "Answer from the numbered sources given with the question. Cite each fact with its source id in square brackets, like [S2]. " +
    "Never invent facts about the course. " +
    "If the sources do not answer the question, start your reply with the exact token [[OUTSIDE]] on its own line, then: " +
    "(1) say in one short sentence that this course does not cover it; " +
    "(2) if it is general workplace or technical knowledge, give a brief, useful general answer (2-4 sentences) and say plainly it is general knowledge, not from the course — do not cite sources for it; " +
    "(3) for anything specific to the company (policies, benefits, leave, pay, numbers, people, internal tools or procedures) give no general answer, no typical figures and no ranges at all — only say who to ask, such as HR or their supervisor; " +
    "(4) if one of the other courses listed clearly fits the question, suggest it by its exact name; if none fits, do not mention them. " +
    "If the sources answer only part of it, answer that part with citations and say what is not covered. " +
    (lang === "th"
      ? "Reply in Thai, in a friendly, clear tone. "
      : "Reply in English, in a friendly, clear tone. ") +
    "Keep it short: a few sentences or a short list.";

  const record = await db.aiQuestion.create({
    data: { userId: viewer.userId, courseId: course.id, question },
    select: { id: true },
  });

  const encoder = new TextEncoder();
  const meta = {
    sources: sources.map((s) => ({
      id: s.id,
      chapterId: s.chapterId,
      chapterNo: s.chapterNo,
      chapterTitle: s.chapterTitle,
      sec: s.sec,
      page: s.page ?? null,
      documentId: s.documentId ?? null,
    })),
    remaining: Math.max(0, DAILY_LIMIT - used - 1),
    related,
  };

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify(meta) + "\n"));
      let answer = "";
      try {
        // the company's own facts are never guessed: without them in the
        // material, the answer is where to ask, written here rather than by the model
        if (companySpecific && !(await sourcesAnswer(question, sourceText))) {
          answer =
            "[[OUTSIDE]]\n" +
            (lang === "th"
              ? "เรื่องนี้เป็นข้อมูลเฉพาะของบริษัท ซึ่งไม่มีอยู่ในเนื้อหาคอร์สนี้ ผู้ช่วยจึงไม่ตอบแทน เพื่อไม่ให้ได้ข้อมูลที่อาจไม่ตรงกับนโยบายจริง\n\nสอบถามได้ที่ฝ่าย HR (HROD) หรือหัวหน้าของคุณ"
              : "This is specific to the company and isn't in this course's material, so the assistant won't guess — the real policy may differ.\n\nPlease ask HR (HROD) or your supervisor.");
          controller.enqueue(encoder.encode(answer));
          return;
        }
        const completion = await typhoon().chat.completions.create({
          model: TYPHOON_CHAT_MODEL,
          temperature: 0.3,
          max_tokens: 900,
          stream: true,
          messages: [
            { role: "system", content: system },
            ...history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
            { role: "user", content: `Sources:\n${sourceText || "(none)"}${relatedText}\n\nQuestion: ${question}` },
          ],
        });
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            answer += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch {
        const sorry =
          lang === "th"
            ? "ขออภัย ตอนนี้ผู้ช่วยตอบไม่ได้ ลองใหม่อีกครั้งในอีกสักครู่"
            : "Sorry — the assistant can't answer right now. Please try again in a moment.";
        answer = answer || sorry;
        controller.enqueue(encoder.encode(answer === sorry ? sorry : ""));
      } finally {
        await db.aiQuestion.update({ where: { id: record.id }, data: { answer: answer.slice(0, 8000) } }).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
