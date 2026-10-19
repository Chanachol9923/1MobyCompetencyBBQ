import "server-only";
import { db } from "@/lib/db";
import { typhoon, TYPHOON_CHAT_MODEL } from "@/server/typhoon";

/**
 * The study assistant's reading: summaries written once per video, and the
 * retrieval behind questions (RAG).
 *
 * Typhoon offers no embedding model, so retrieval is lexical: Thai is split
 * into words with the ICU segmenter built into Node (`Intl.Segmenter`), and
 * passages are ranked with BM25. Typhoon first rewrites the question into
 * search terms in Thai and English, which covers most of what embeddings
 * would add — an English question still finds a Thai lecture.
 */

/* ------------------------------------------------------------ summaries */

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** What a transcript is a transcript of: a course chapter or a short. */
async function contextOf(mediaUrl: string) {
  const chapter = await db.chapter.findFirst({
    where: { mediaUrl },
    select: { titleEn: true, titleTh: true, course: { select: { titleEn: true, titleTh: true } } },
  });
  if (chapter) {
    return `Course: ${chapter.course.titleTh ?? chapter.course.titleEn} (${chapter.course.titleEn})\nChapter: ${chapter.titleTh ?? chapter.titleEn} (${chapter.titleEn})`;
  }
  const short = await db.shortVideo.findFirst({ where: { videoUrl: mediaUrl }, select: { titleEn: true, titleTh: true } });
  return short ? `Short video: ${short.titleTh ?? short.titleEn} (${short.titleEn})` : "A training video";
}

/** Pull the first JSON object out of a model reply. */
function firstJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  const body = text.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // the commonest slip: a trailing comma before a closing bracket
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"));
  }
}

/**
 * A summary in Thai and English with key points, written once when the
 * transcript is ready and stored — reading it never calls the model again.
 */
export async function summarizeTranscript(transcriptId: string) {
  const t = await db.mediaTranscript.findUnique({
    where: { id: transcriptId },
    select: { mediaUrl: true, cues: { orderBy: { startMs: "asc" }, select: { startMs: true, text: true } } },
  });
  if (!t) return;
  if (!t.cues.length) {
    await db.mediaTranscript.update({
      where: { id: transcriptId },
      data: { summaryError: "No speech was found in this video." },
    });
    return;
  }
  const lines = t.cues.map((c) => `[${mmss(c.startMs)}] ${c.text}`).join("\n");
  const context = await contextOf(t.mediaUrl);
  // JSON mode keeps the reply to the shape; one retry covers a bad sample
  const ask = async () => {
    const res = await typhoon().chat.completions.create({
      model: TYPHOON_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You summarise transcripts of company training videos for employees. Write only what the transcript says; never add facts. " +
            'Reply with JSON only, exactly this shape: {"summary_th": string, "summary_en": string, "key_points_th": string[], "key_points_en": string[]}. ' +
            "Summaries are 2-4 sentences. Give 3-6 key points, each one short sentence, in the order they come up.",
        },
        { role: "user", content: `${context}\n\nTranscript:\n${lines.slice(0, 60_000)}` },
      ],
    });
    return firstJson(res.choices[0]?.message?.content ?? "") as Record<string, unknown>;
  };
  try {
    // an occasional reply is malformed even in JSON mode: three tries
    const j = await ask().catch(ask).catch(ask);
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const list = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 8) : [];
    if (!str(j.summary_th) && !str(j.summary_en)) throw new Error("The summary came back empty.");
    await db.mediaTranscript.update({
      where: { id: transcriptId },
      data: {
        summaryTh: str(j.summary_th) || null,
        summaryEn: str(j.summary_en) || null,
        keyPointsTh: list(j.key_points_th),
        keyPointsEn: list(j.key_points_en),
        summaryError: null,
      },
    });
  } catch (err) {
    await db.mediaTranscript.update({
      where: { id: transcriptId },
      data: { summaryError: err instanceof Error ? err.message.slice(0, 300) : "Summary failed." },
    });
  }
}

/* ------------------------------------------------------------ retrieval */

const thai = new Intl.Segmenter("th", { granularity: "word" });
const STOP = new Set(
  (
    "the a an is are of to and or in on for with what how why do does this that it be was " +
    "ที่ และ ของ ใน ให้ ได้ ว่า เป็น มี การ ความ จะ ไม่ ก็ แล้ว กับ คือ นี้ นั้น อะไร อย่างไร ยังไง ไหม บ้าง ครับ ค่ะ คะ นะ หรือ ซึ่ง โดย จาก"
  ).split(" "),
);

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const s of thai.segment(text.toLowerCase())) {
    if (!s.isWordLike) continue;
    const w = s.segment.trim();
    if (w.length < 2 && !/[0-9]/.test(w)) continue;
    if (STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}

export type Passage = {
  /** what the model cites, e.g. "S3" */
  id: string;
  chapterId: string;
  chapterNo: number;
  chapterTitle: string;
  /** seconds into the chapter's video, when the passage is speech */
  sec: number | null;
  text: string;
};

/** Every passage of a course: the chapters' own text and their videos' speech. */
export async function coursePassages(courseId: string, lang: "th" | "en") {
  const chapters = await db.chapter.findMany({
    where: { courseId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
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
  });
  const urls = chapters.map((c) => c.mediaUrl).filter((u): u is string => !!u);
  const transcripts = urls.length
    ? await db.mediaTranscript.findMany({
        where: { mediaUrl: { in: urls }, status: "READY" },
        select: { mediaUrl: true, cues: { orderBy: { startMs: "asc" }, select: { startMs: true, text: true } } },
      })
    : [];
  const byUrl = new Map(transcripts.map((t) => [t.mediaUrl, t.cues]));

  const passages: Omit<Passage, "id">[] = [];
  chapters.forEach((c, i) => {
    const title = lang === "th" ? (c.titleTh ?? c.titleEn) : c.titleEn;
    const base = { chapterId: c.id, chapterNo: i + 1, chapterTitle: title };
    const own = [
      c.summaryTh ?? "",
      c.summaryEn ?? "",
      ...c.bulletsTh,
      ...c.bulletsEn,
    ].filter(Boolean).join("\n");
    if (own) passages.push({ ...base, sec: null, text: `${c.titleTh ?? ""} ${c.titleEn}\n${own}` });
    for (const para of [c.bodyTh, c.bodyEn].filter(Boolean).join("\n\n").split(/\n{2,}/)) {
      if (para.trim()) passages.push({ ...base, sec: null, text: para.trim() });
    }
    // speech, grouped into about a minute per passage
    const cues = c.mediaUrl ? byUrl.get(c.mediaUrl) : undefined;
    let group: { startMs: number; text: string }[] = [];
    const flush = () => {
      if (!group.length) return;
      passages.push({ ...base, sec: Math.floor(group[0]!.startMs / 1000), text: group.map((g) => g.text).join(" ") });
      group = [];
    };
    for (const cue of cues ?? []) {
      if (group.length && cue.startMs - group[0]!.startMs > 60_000) flush();
      group.push(cue);
    }
    flush();
  });
  return passages;
}

/** BM25 over the passages; the best `k`, in course order. */
export function rank(passages: Omit<Passage, "id">[], query: string, k = 6) {
  const docs = passages.map((p) => tokenize(p.text));
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const q = [...new Set(tokenize(query))];
  const N = docs.length;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of q) {
      const f = tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.length / Math.max(1, avg))));
    }
    return { i, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .sort((a, b) => a.i - b.i)
    .map((s, n) => ({ ...passages[s.i]!, id: `S${n + 1}` }));
}

/** Turn a question into search terms in Thai and English. Falls back to the question. */
export async function searchTerms(question: string, courseTitle: string): Promise<string> {
  try {
    const res = await typhoon().chat.completions.create(
      {
        model: TYPHOON_CHAT_MODEL,
        temperature: 0,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the learner's question as search keywords for a course's transcripts. Give Thai and English keywords and close synonyms, separated by spaces, on one line. No explanation.",
          },
          { role: "user", content: `Course: ${courseTitle}\nQuestion: ${question}` },
        ],
      },
      { timeout: 10_000, maxRetries: 0 },
    );
    return `${question} ${res.choices[0]?.message?.content ?? ""}`;
  } catch {
    return question;
  }
}
