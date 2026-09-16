/**
 * The vocabulary the LMS shares between the server and the browser.
 *
 * `src/server/learning.ts` is `server-only`, so a client component can import
 * its *types* but never its values. Anything both halves need at runtime — the
 * content-type labels, the pass mark, the points a flow awards — lives here
 * instead, in a module with no server imports and no `"use client"`.
 *
 * The enum spellings are Prisma's, not the old demo store's: a chapter kind is
 * `VIDEO`, not `"video"`, so nothing has to translate casing on the way out of
 * a query.
 */

export type Lang = "en" | "th";

/** English is the fallback whenever a Thai column is empty. */
export function pick(lang: Lang, en: string, th?: string | null): string {
  return lang === "th" && th ? th : en;
}

/** Same rule for a column that may be missing in both languages. */
export function pickMaybe(
  lang: Lang,
  en: string | null,
  th?: string | null,
): string | null {
  if (lang === "th" && th) return th;
  return en;
}

/* ------------------------------------------------------------ content type */

export type ChapterKind = "VIDEO" | "PDF" | "ARTICLE";

export const CHAPTER_KINDS: ChapterKind[] = ["VIDEO", "PDF", "ARTICLE"];

export const CHAPTER_KIND_LABEL: Record<ChapterKind, { en: string; th: string }> = {
  VIDEO: { en: "Video", th: "วิดีโอ" },
  PDF: { en: "PDF", th: "เอกสาร PDF" },
  ARTICLE: { en: "Article", th: "บทความ" },
};

/* ---------------------------------------------------------------- category */

export type CourseCategory = "CORE" | "FUNCTIONAL" | "MANAGERIAL";

export const COURSE_CATEGORIES: CourseCategory[] = [
  "CORE",
  "FUNCTIONAL",
  "MANAGERIAL",
];

/** Reuses the shared dictionary rather than a second copy of the wording. */
export const categoryDictKey = (c: CourseCategory) =>
  `group.${c.toLowerCase()}` as const;

/* ------------------------------------------------------------------ rules */

/** Pass mark for the post-test, in percent. */
export const PASS_MARK = 70;

/** Points the LMS flows award, written to the ledger once each. */
export const LMS_POINTS = {
  /** finishing every chapter of a course */
  course: 50,
  /** passing the post-test, awarded with the certificate */
  postTest: 40,
} as const;

/** Reasons written on the point ledger, so an award can be recognised again. */
export const POINT_REASON = {
  course: "Completed a course",
  postTest: "Passed a course post-test",
  path: "Completed a learning path",
} as const;

/**
 * `refType` values on the ledger, which is how a double award is prevented.
 *
 * The convention is the model the award came from — `/assessment` writes
 * `refType: "Assessment"` against the assessment id, so finishing a course
 * writes `"Course"` against the course id. The post-test rides on the same
 * course id, so it gets a type of its own rather than colliding with it.
 */
export const POINT_REF = {
  course: "Course",
  postTest: "CourseCertificate",
  path: "LearningPath",
} as const;

/* ----------------------------------------------------------- default cover */

/** Courses seeded before covers existed still render a gradient. */
export const FALLBACK_COVER = "from-[#006bff] to-[#0b1b3f]";
