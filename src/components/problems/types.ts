/**
 * Shapes exchanged between the problem-report screens and `src/server/problems.ts`,
 * kept here because a "use server" module may only export async functions.
 */

export type ProblemCategoryValue = "BUG" | "DATA" | "ACCESS" | "SUGGESTION" | "OTHER";
export type ProblemStatusValue = "OPEN" | "IN_PROGRESS" | "FIXED";

export const PROBLEM_CATEGORIES: ProblemCategoryValue[] = ["BUG", "DATA", "ACCESS", "SUGGESTION", "OTHER"];

export const CATEGORY_LABEL: Record<ProblemCategoryValue, { en: string; th: string; hintEn: string; hintTh: string }> = {
  BUG: {
    en: "Something is broken",
    th: "ระบบทำงานผิดพลาด",
    hintEn: "An error, a button that does nothing, a page that won't load",
    hintTh: "มีข้อผิดพลาด ปุ่มกดไม่ได้ หรือหน้าโหลดไม่ขึ้น",
  },
  DATA: {
    en: "Information is wrong",
    th: "ข้อมูลไม่ถูกต้อง",
    hintEn: "A score, a name, points or a course that isn't right",
    hintTh: "คะแนน ชื่อ แต้ม หรือหลักสูตรที่ไม่ถูกต้อง",
  },
  ACCESS: {
    en: "I can't get to something",
    th: "เข้าถึงไม่ได้",
    hintEn: "A page or feature you should be able to use",
    hintTh: "หน้าหรือฟังก์ชันที่ควรใช้ได้แต่ใช้ไม่ได้",
  },
  SUGGESTION: {
    en: "Suggestion",
    th: "ข้อเสนอแนะ",
    hintEn: "Something that would make the system better",
    hintTh: "สิ่งที่จะทำให้ระบบดีขึ้น",
  },
  OTHER: { en: "Other", th: "อื่น ๆ", hintEn: "Anything else", hintTh: "เรื่องอื่น ๆ" },
};

export const STATUS_LABEL: Record<ProblemStatusValue, { en: string; th: string }> = {
  OPEN: { en: "Unclaimed", th: "ยังไม่มีผู้รับเรื่อง" },
  IN_PROGRESS: { en: "In progress", th: "กำลังดำเนินการ" },
  FIXED: { en: "Fixed", th: "แก้ไขแล้ว" },
};

/** at most this many screenshots on a report, and evidence images on a fix */
export const MAX_IMAGES = 4;

export type ProblemPerson = { userId: string; name: string; email: string };

export type ProblemClaimRow = ProblemPerson & {
  /** ISO timestamp */
  claimedAt: string;
};

export type ProblemRow = {
  id: string;
  number: number;
  category: ProblemCategoryValue;
  title: string;
  description: string;
  pageUrl: string | null;
  userAgent: string | null;
  attachments: string[];
  status: ProblemStatusValue;
  reporter: ProblemPerson;
  claims: ProblemClaimRow[];
  resolutionNote: string | null;
  resolutionImages: string[];
  resolvedBy: ProblemPerson | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProblemsAdminData = {
  problems: ProblemRow[];
  counts: Record<ProblemStatusValue, number>;
  /** the signed-in admin, so the screen knows which claims are theirs */
  me: string;
};

/** A report as the person who sent it sees it. */
export type MyProblemRow = Omit<ProblemRow, "claims" | "reporter" | "userAgent"> & {
  /** who is on it, by name only */
  handlers: string[];
};

export type ProblemResult =
  | { ok: true; message: { en: string; th: string }; number?: number }
  | { ok: false; error: { en: string; th: string } };
