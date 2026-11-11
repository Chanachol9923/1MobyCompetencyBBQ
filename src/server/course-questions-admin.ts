"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { NotAuthorised, assertPermission, recordActivity } from "@/server/session";
import { typhoon, TYPHOON_CHAT_MODEL, typhoonConfigured } from "@/server/typhoon";
import { parseOptions } from "@/server/course-test";
import type { Bilingual } from "@/components/admin/admin-types";

/**
 * The administrator's side of the pre/post-test bank (`CourseQuestion`).
 *
 * An administrator writes the questions, or asks Typhoon for a draft written
 * from the whole course and then checks and edits it before saving — a draft
 * is never saved on its own. Saving replaces the course's bank in one
 * transaction. All of it sits behind `manage_lms`, like the course editor.
 *
 * Until migration 0015 is applied the table does not exist: reading says so
 * (`available: false`) and saving refuses, rather than failing loudly.
 */

export type BankQuestion = {
  stemEn: string;
  stemTh: string;
  options: Bilingual[];
  answerIndex: number;
  explainEn: string;
  explainTh: string;
};

export type BankResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Bilingual };

const msg = (en: string, th: string): Bilingual => ({ en, th });
const fail = (en: string, th: string) => ({ ok: false as const, error: msg(en, th) });

const NO_TABLE = () =>
  fail(
    "The question bank is not set up in the database yet (migration 0015).",
    "ฐานข้อมูลยังไม่มีคลังข้อสอบ (ต้องรัน migration 0015 ก่อน)",
  );

function isMissingTable(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "P2021" ||
    (/CourseQuestion/.test(e?.message ?? "") && /does not exist/i.test(e?.message ?? ""))
  );
}

async function guard() {
  try {
    return await assertPermission(PERMISSIONS.MANAGE_LMS);
  } catch (err) {
    if (err instanceof NotAuthorised) return null;
    throw err;
  }
}

const DENIED = () =>
  fail("You do not have permission to edit courses.", "คุณไม่มีสิทธิ์แก้ไขหลักสูตร");

const courseIdSchema = z.object({ courseId: z.string().min(1).max(64) });

/* -------------------------------------------------------------------- read */

export async function getCourseQuestionBank(
  input: z.input<typeof courseIdSchema>,
): Promise<BankResult<{ available: boolean; aiAvailable: boolean; questions: BankQuestion[] }>> {
  if (!(await guard())) return DENIED();
  const parsed = courseIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown course.", "ไม่พบหลักสูตร");

  const aiAvailable = typhoonConfigured();
  try {
    const rows = await db.courseQuestion.findMany({
      where: { courseId: parsed.data.courseId },
      orderBy: { sortOrder: "asc" },
    });
    return {
      ok: true,
      data: {
        available: true,
        aiAvailable,
        questions: rows.map((q) => ({
          stemEn: q.stemEn,
          stemTh: q.stemTh ?? "",
          options: parseOptions(q.options) ?? [],
          answerIndex: q.answerIndex,
          explainEn: q.explainEn ?? "",
          explainTh: q.explainTh ?? "",
        })),
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { ok: true, data: { available: false, aiAvailable, questions: [] } };
    }
    throw err;
  }
}

/* -------------------------------------------------------------------- save */

const text = (max: number) => z.string().trim().max(max);

const questionSchema = z
  .object({
    stemEn: text(600).min(1),
    stemTh: text(600),
    options: z
      .array(z.object({ en: text(300), th: text(300) }))
      .min(2)
      .max(6),
    answerIndex: z.number().int().min(0).max(5),
    explainEn: text(600),
    explainTh: text(600),
  })
  .refine((q) => q.answerIndex < q.options.length, "answer")
  .refine((q) => q.options.every((o) => o.en || o.th), "option");

const saveSchema = courseIdSchema.extend({
  questions: z.array(questionSchema).max(50),
});

export async function saveCourseQuestionBank(
  input: z.input<typeof saveSchema>,
): Promise<BankResult<{ count: number }>> {
  const viewer = await guard();
  if (!viewer) return DENIED();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "Every question needs an English question, at least two options with text, and a correct answer.",
      "ทุกข้อต้องมีคำถามภาษาอังกฤษ ตัวเลือกที่มีข้อความอย่างน้อยสองตัวเลือก และเฉลยหนึ่งข้อ",
    );
  }
  const { courseId, questions } = parsed.data;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, titleEn: true },
  });
  if (!course) return fail("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว");

  try {
    await db.$transaction([
      // the bank is replaced as a whole; past results keep their scores
      db.courseQuestion.deleteMany({ where: { courseId } }),
      db.courseQuestion.createMany({
        data: questions.map((q, i) => ({
          courseId,
          sortOrder: i,
          stemEn: q.stemEn,
          stemTh: q.stemTh || null,
          options: q.options.map((o) => ({ en: o.en || o.th, th: o.th || o.en })),
          answerIndex: q.answerIndex,
          explainEn: q.explainEn || null,
          explainTh: q.explainTh || null,
        })),
      }),
    ]);
  } catch (err) {
    if (isMissingTable(err)) return NO_TABLE();
    throw err;
  }

  await recordActivity({
    viewer,
    action: "Saved course test questions",
    targetType: "Course",
    targetId: course.id,
    targetLabel: course.titleEn,
    detail: `${questions.length} questions`,
  });
  revalidatePath(`/lms/${course.slug}`);
  revalidatePath("/admin/lms");
  return { ok: true, data: { count: questions.length } };
}

/* ---------------------------------------------------------------- AI draft */

/** Keep only well-formed drafted questions; the model's JSON is not trusted. */
function cleanDraft(raw: unknown): BankQuestion[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const out: BankQuestion[] = [];
  for (const q of list as Record<string, unknown>[]) {
    const stemEn = str(q?.questionEn);
    const stemTh = str(q?.questionTh);
    const options = Array.isArray(q?.options)
      ? (q.options as Record<string, unknown>[]).map((o) => ({ en: str(o?.en), th: str(o?.th) }))
      : [];
    const answer = typeof q?.answer === "number" ? q.answer : -1;
    if (!stemEn && !stemTh) continue;
    if (options.length < 3 || options.length > 4 || options.some((o) => !o.en && !o.th)) continue;
    if (answer < 0 || answer >= options.length) continue;
    out.push({
      stemEn: stemEn || stemTh,
      stemTh,
      options: options.map((o) => ({ en: o.en || o.th, th: o.th || o.en })),
      answerIndex: answer,
      explainEn: str(q?.explainEn),
      explainTh: str(q?.explainTh),
    });
  }
  return out.slice(0, 10);
}

function firstJson(reply: string): unknown {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  const raw = reply.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

/**
 * A draft of the whole bank from the whole course, for the administrator to
 * check and edit. Nothing is saved here. Without `TYPHOON_API_KEY` it says the
 * assistant is off and the administrator writes the questions by hand.
 */
export async function draftCourseQuestionsWithAi(
  input: z.input<typeof courseIdSchema>,
): Promise<BankResult<{ questions: BankQuestion[] }>> {
  const viewer = await guard();
  if (!viewer) return DENIED();
  if (!typhoonConfigured()) {
    return fail(
      "The AI assistant is not switched on — write the questions by hand.",
      "ยังไม่ได้เปิดใช้ผู้ช่วย AI กรุณาเขียนข้อสอบเอง",
    );
  }
  const parsed = courseIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown course.", "ไม่พบหลักสูตร");

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      descriptionEn: true,
      descriptionTh: true,
      chapters: {
        orderBy: { sortOrder: "asc" },
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
        },
      },
    },
  });
  if (!course) return fail("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว");

  // what the videos say, where subtitles exist — in one query
  const urls = course.chapters.map((c) => c.mediaUrl).filter((u): u is string => Boolean(u));
  const transcripts = urls.length
    ? await db.mediaTranscript.findMany({
        where: { mediaUrl: { in: urls }, status: "READY" },
        select: { mediaUrl: true, cues: { orderBy: { startMs: "asc" }, select: { text: true } } },
      })
    : [];
  const speechOf = new Map(transcripts.map((t) => [t.mediaUrl, t.cues.map((c) => c.text).join(" ")]));

  const material = [
    `Course: ${course.titleTh ?? ""} (${course.titleEn})`,
    course.descriptionTh ?? "",
    course.descriptionEn ?? "",
    ...course.chapters.map((c, i) =>
      [
        `Chapter ${i + 1}: ${c.titleTh ?? ""} (${c.titleEn})`,
        c.summaryTh ?? "",
        c.summaryEn ?? "",
        ...c.bulletsTh,
        ...c.bulletsEn,
        c.bodyTh ?? "",
        c.bodyEn ?? "",
        c.mediaUrl && speechOf.get(c.mediaUrl) ? `Video: ${speechOf.get(c.mediaUrl)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 30_000);

  const system =
    "You write the pre/post-test for a corporate training course, to check whether an employee understood and can apply it. " +
    "Use only the material given; never test facts it does not contain. " +
    "Write 8 multiple-choice questions spread across the chapters, each with 4 options and exactly one correct answer. " +
    "Ask about understanding and applying the ideas, not trivia like chapter numbers or titles. " +
    "Wrong options must be plausible but clearly wrong according to the material; keep options short and similar in length. " +
    "Write every text in both English and Thai (technical terms may stay in English in the Thai). " +
    'Reply with JSON only: {"questions": [{"questionEn": string, "questionTh": string, ' +
    '"options": [{"en": string, "th": string} x4], "answer": index of the correct option (0-3), ' +
    '"explainEn": one sentence on why it is right, "explainTh": the same in Thai}]}';

  const ask = async () => {
    const res = await typhoon().chat.completions.create(
      {
        model: TYPHOON_CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 5000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Material:\n${material}` },
        ],
      },
      { timeout: 50_000, maxRetries: 0 },
    );
    const questions = cleanDraft(firstJson(res.choices[0]?.message?.content ?? ""));
    if (questions.length < 3) throw new Error("Too few usable questions.");
    return questions;
  };

  try {
    const questions = await ask().catch(ask);
    await recordActivity({
      viewer,
      action: "Drafted course test with AI",
      targetType: "Course",
      targetId: course.id,
      targetLabel: course.titleEn,
      detail: `${questions.length} questions`,
    });
    return { ok: true, data: { questions } };
  } catch {
    return fail(
      "The AI could not draft questions right now. Try again, or write them by hand.",
      "AI ร่างข้อสอบไม่สำเร็จในตอนนี้ ลองใหม่อีกครั้ง หรือเขียนข้อสอบเอง",
    );
  }
}
