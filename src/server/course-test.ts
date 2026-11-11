import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  buildCourseTest,
  seededRandom,
  type Bilingual,
  type TestVariant,
} from "@/components/learning/testEngine";

/**
 * The pre/post-test paper, built and graded on the server.
 *
 * A paper is derived from the course and the kind of test alone, so it is the
 * same paper every time it is asked for: the browser is handed the questions
 * *without* their answers, sends back the options it picked, and the server
 * rebuilds the same paper to grade them. The browser never states a score and
 * never sees the key before it has handed its answers in.
 *
 * Questions come from the course's bank (`CourseQuestion`) when it has any —
 * the pre-test and the post-test draw from it in different orders, with the
 * options shuffled differently. A course with an empty bank falls back to the
 * paper generated from its chapters (`testEngine.ts`), as before.
 */

export type TestKind = "PRE" | "POST";

/** A question as the learner sees it — no answer. */
export type PaperQuestion = {
  id: string;
  stem: Bilingual;
  options: Bilingual[];
};

/** What the browser receives. `key` pins the exact paper it was given. */
export type PublicPaper = {
  key: string;
  source: "bank" | "generated";
  questions: PaperQuestion[];
};

type GradedQuestion = PaperQuestion & {
  answerIndex: number;
  explain: Bilingual | null;
};

type Paper = Omit<PublicPaper, "questions"> & { questions: GradedQuestion[] };

/** One answer after grading, returned once the paper is handed in. */
export type ReviewItem = {
  chosen: number | null;
  answerIndex: number;
  correct: boolean;
  explain: Bilingual | null;
};

/** The most questions one paper asks; a bigger bank is sampled per test. */
export const PAPER_SIZE = 10;

const variantOf = (kind: TestKind): TestVariant => (kind === "PRE" ? "pre" : "post");

/** The table arrives with migration 0015; until then there is simply no bank. */
function isMissingTable(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "P2021" ||
    (/CourseQuestion/.test(e?.message ?? "") && /does not exist/i.test(e?.message ?? ""))
  );
}

type BankRow = {
  id: string;
  stemEn: string;
  stemTh: string | null;
  options: unknown;
  answerIndex: number;
  explainEn: string | null;
  explainTh: string | null;
};

/**
 * Whether the table exists yet, asked once rather than on every paper: a
 * failed Prisma query would log an error each time. Once it exists it stays;
 * an absence is re-checked after a minute so the migration is picked up.
 */
let tableSeen: { exists: boolean; at: number } | null = null;
async function bankTableExists(): Promise<boolean> {
  if (tableSeen && (tableSeen.exists || Date.now() - tableSeen.at < 60_000)) {
    return tableSeen.exists;
  }
  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public."CourseQuestion"') IS NOT NULL AS "exists"`;
  tableSeen = { exists: Boolean(rows[0]?.exists), at: Date.now() };
  return tableSeen.exists;
}

async function loadBank(courseId: string): Promise<BankRow[]> {
  if (!(await bankTableExists())) return [];
  try {
    return await db.courseQuestion.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        stemEn: true,
        stemTh: true,
        options: true,
        answerIndex: true,
        explainEn: true,
        explainTh: true,
      },
    });
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** `options` is JSON: keep it only when it is a list of {en, th?} with text. */
export function parseOptions(raw: unknown): Bilingual[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Bilingual[] = [];
  for (const o of raw) {
    const en = typeof o?.en === "string" ? o.en.trim() : "";
    const th = typeof o?.th === "string" ? o.th.trim() : "";
    if (!en && !th) return null;
    out.push({ en: en || th, th: th || en });
  }
  return out.length >= 2 ? out : null;
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Exported for checking only; the paper is built through `publicPaper`. */
export function fromBank(courseId: string, kind: TestKind, bank: BankRow[]): GradedQuestion[] {
  const rnd = seededRandom(`${courseId}:${kind}:bank`);
  const usable = bank.flatMap((q) => {
    const options = parseOptions(q.options);
    if (!options || q.answerIndex < 0 || q.answerIndex >= options.length) return [];
    return [{ q, options }];
  });
  return shuffle(usable, rnd)
    .slice(0, PAPER_SIZE)
    .map(({ q, options }) => {
      const order = shuffle(
        options.map((_, i) => i),
        rnd,
      );
      const explain =
        q.explainEn || q.explainTh
          ? { en: q.explainEn || q.explainTh || "", th: q.explainTh || q.explainEn || "" }
          : null;
      return {
        id: q.id,
        stem: { en: q.stemEn, th: q.stemTh || q.stemEn },
        options: order.map((i) => options[i]!),
        answerIndex: order.indexOf(q.answerIndex),
        explain,
      };
    });
}

async function generated(courseId: string, kind: TestKind): Promise<GradedQuestion[]> {
  const chapters = await db.chapter.findMany({
    where: { courseId },
    orderBy: { sortOrder: "asc" },
    select: { titleEn: true, titleTh: true, bulletsEn: true, bulletsTh: true },
  });
  return buildCourseTest({ courseId, chapters }, variantOf(kind)).map((q) => ({
    ...q,
    explain: null,
  }));
}

function keyOf(courseId: string, kind: TestKind, questions: GradedQuestion[]) {
  return createHash("sha256")
    .update(JSON.stringify([courseId, kind, questions]))
    .digest("base64url")
    .slice(0, 24);
}

/** The paper for this course and kind, answers included — server use only. */
async function buildPaper(courseId: string, kind: TestKind): Promise<Paper> {
  const bank = fromBank(courseId, kind, await loadBank(courseId));
  const questions = bank.length ? bank : await generated(courseId, kind);
  return {
    key: keyOf(courseId, kind, questions),
    source: bank.length ? "bank" : "generated",
    questions,
  };
}

/** The paper as the learner may see it: the same questions, no key. */
export async function publicPaper(courseId: string, kind: TestKind): Promise<PublicPaper> {
  const paper = await buildPaper(courseId, kind);
  return {
    key: paper.key,
    source: paper.source,
    questions: paper.questions.map(({ id, stem, options }) => ({ id, stem, options })),
  };
}

export type GradeResult =
  | { ok: true; score: number; review: ReviewItem[] }
  | { ok: false; error: "paper_changed" | "invalid" };

/**
 * Grade the answers to the paper identified by `key`. When the bank changed
 * since the paper was handed out the key no longer matches and nothing is
 * graded — the learner is asked to open the test again.
 */
export async function gradePaper(
  courseId: string,
  kind: TestKind,
  key: string,
  answers: (number | null)[],
): Promise<GradeResult> {
  const paper = await buildPaper(courseId, kind);
  if (paper.key !== key) return { ok: false, error: "paper_changed" };
  if (answers.length !== paper.questions.length) return { ok: false, error: "invalid" };

  const review = paper.questions.map((q, i) => {
    const chosen = answers[i] ?? null;
    const valid = chosen !== null && chosen >= 0 && chosen < q.options.length;
    return {
      chosen: valid ? chosen : null,
      answerIndex: q.answerIndex,
      correct: valid && chosen === q.answerIndex,
      explain: q.explain,
    };
  });
  const right = review.filter((r) => r.correct).length;
  const score = paper.questions.length
    ? Math.round((right / paper.questions.length) * 100)
    : 0;
  return { ok: true, score, review };
}
