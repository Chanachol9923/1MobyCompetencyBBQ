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

/* ----------------------------------------------------------- correction */

/**
 * What the video is meant to say, for the correction pass: the chapter's (or
 * short's) own text and the course glossary. Speech recognition hears English
 * loanwords as Thai look-alikes ("โค้ด" as "คุด"); this is what lets the model
 * tell which word was meant.
 */
async function referenceOf(mediaUrl: string) {
  const chapter = await db.chapter.findFirst({
    where: { mediaUrl },
    select: {
      titleEn: true,
      titleTh: true,
      summaryEn: true,
      summaryTh: true,
      bulletsEn: true,
      bulletsTh: true,
      course: { select: { titleEn: true, titleTh: true, glossary: true, descriptionTh: true } },
    },
  });
  if (chapter) {
    return {
      glossary: chapter.course.glossary,
      text: [
        `Course: ${chapter.course.titleTh ?? ""} (${chapter.course.titleEn})`,
        chapter.course.descriptionTh ?? "",
        `Chapter: ${chapter.titleTh ?? ""} (${chapter.titleEn})`,
        chapter.summaryTh ?? "",
        chapter.summaryEn ?? "",
        ...chapter.bulletsTh,
        ...chapter.bulletsEn,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  const short = await db.shortVideo.findFirst({
    where: { videoUrl: mediaUrl },
    select: {
      titleEn: true,
      titleTh: true,
      captionEn: true,
      captionTh: true,
      course: { select: { titleEn: true, glossary: true } },
    },
  });
  return {
    glossary: short?.course?.glossary ?? [],
    text: short
      ? [`Short video: ${short.titleTh ?? ""} (${short.titleEn})`, short.captionTh ?? "", short.captionEn ?? "", short.course?.titleEn ?? ""]
          .filter(Boolean)
          .join("\n")
      : "A training video",
  };
}

/** Characters changed between two lines (Levenshtein). */
function editDistance(a: string, b: string) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * A fix is a word or two, not a rewrite: anything that changes much of the
 * line is the model paraphrasing, and the line stays as it was heard.
 */
function plausibleFix(heard: string, fixed: string) {
  if (!fixed || fixed === heard) return false;
  const limit = Math.max(8, Math.round(heard.length * 0.4));
  return editDistance(heard, fixed) <= limit && fixed.length <= heard.length * 1.6 + 10;
}

const BATCH = 40;

/** The recogniser writes sara am as two marks (ํ + า); everything else uses one (ำ). */
const SARA_AM_SPLIT = new RegExp(String.fromCharCode(0x0e4d, 0x0e32), "g");
const thaiForm = (s: string) => s.replace(SARA_AM_SPLIT, String.fromCharCode(0x0e33));

/**
 * Fix the words speech recognition misheard, using what the video is about.
 * Runs once after transcription, before the summary. What was heard is kept in
 * `rawText`, so a later run (say, after the glossary changes) starts again
 * from it; lines an admin corrected are left alone.
 */
export async function correctTranscript(transcriptId: string) {
  const t = await db.mediaTranscript.findUnique({
    where: { id: transcriptId },
    select: {
      mediaUrl: true,
      cues: { orderBy: { startMs: "asc" }, select: { id: true, text: true, rawText: true, edited: true } },
    },
  });
  if (!t) return;
  const lines = t.cues
    .filter((c) => !c.edited)
    .map((c) => ({ id: c.id, heard: thaiForm(c.rawText ?? c.text), now: c.text }));
  const ref = await referenceOf(t.mediaUrl);
  const glossary = ref.glossary.length ? `\nGlossary (spell these exactly so): ${ref.glossary.join(", ")}` : "";

  const ask = async (batch: typeof lines) => {
    const res = await typhoon().chat.completions.create({
      model: TYPHOON_CHAT_MODEL,
      temperature: 0,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You proofread Thai speech-recognition output from company training videos. " +
            "The recogniser often mishears English loanwords and technical terms as Thai words that sound alike " +
            '(for example "คุด" for "โค้ด", "คอนเฟิร์ต" for "conflict"). ' +
            "Using the reference text and glossary, fix only words that are clearly misheard. " +
            "A Thai word that makes sense where it stands is not a mistake, even if another word would also fit. " +
            "Keep everything else exactly as it is: do not rephrase, translate, summarise, reorder or add words, and do not change spacing. " +
            "Write a term the way the reference or glossary writes it (Thai or English). If unsure, leave the line alone. " +
            'Reply with JSON only: {"fixes": [{"n": number, "text": string}]} listing only the lines you changed, with n the line number. ' +
            'If nothing needs fixing reply {"fixes": []}.',
        },
        {
          role: "user",
          content: `Reference:\n${ref.text.slice(0, 6000)}${glossary}\n\nLines:\n${batch.map((l, i) => `${i + 1}. ${l.heard}`).join("\n")}`,
        },
      ],
    });
    const j = firstJson(res.choices[0]?.message?.content ?? "") as { fixes?: unknown };
    if (!Array.isArray(j.fixes)) throw new Error("The correction came back in the wrong shape.");
    const out = new Map<number, string>();
    for (const f of j.fixes as { n?: unknown; text?: unknown }[]) {
      if (typeof f?.n === "number" && typeof f.text === "string") out.set(f.n - 1, f.text.trim());
    }
    return out;
  };

  try {
    const updates: { id: string; text: string; rawText: string | null }[] = [];
    for (let i = 0; i < lines.length; i += BATCH) {
      const batch = lines.slice(i, i + BATCH);
      const fixes = await ask(batch).catch(() => ask(batch));
      batch.forEach((l, k) => {
        const fixed = fixes.get(k) && thaiForm(fixes.get(k)!);
        // a reply that only moves spaces about is not a fix
        const real = fixed && fixed.replace(/\s+/g, "") !== l.heard.replace(/\s+/g, "") && plausibleFix(l.heard, fixed);
        const text = real ? fixed : l.heard;
        if (text !== l.now) updates.push({ id: l.id, text, rawText: real ? l.heard : null });
      });
    }
    await db.$transaction([
      ...updates.map((u) => db.transcriptCue.update({ where: { id: u.id }, data: { text: u.text, rawText: u.rawText } })),
      db.mediaTranscript.update({ where: { id: transcriptId }, data: { correctedAt: new Date(), correctionError: null } }),
    ]);
  } catch (err) {
    // the subtitles stay as heard; the summary goes ahead without the fixes
    await db.mediaTranscript.update({
      where: { id: transcriptId },
      data: { correctionError: err instanceof Error ? err.message.slice(0, 300) : "Correction failed." },
    });
  }
}

/* ------------------------------------------------------------ summaries */

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
