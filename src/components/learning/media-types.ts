/**
 * Shapes exchanged between the Shorts / Documents screens and the server.
 * Kept out of the "use server" module, which may only export async functions.
 */

export type Bilingual = { en: string; th: string };

export type MediaRef = { nameEn: string; nameTh: string | null };
export type CourseRef = { slug: string; titleEn: string; titleTh: string | null };

export type ShortCard = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  captionEn: string | null;
  captionTh: string | null;
  videoUrl: string;
  posterUrl: string | null;
  durationSec: number;
  competency: MediaRef | null;
  course: CourseRef | null;
  likes: number;
  liked: boolean;
  completed: boolean;
};

export type DocumentCard = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  fileUrl: string;
  fileBytes: number;
  pages: number;
  competency: MediaRef | null;
  course: CourseRef | null;
  lastPage: number;
  completed: boolean;
  publishedAt: string | null;
};

export type MediaStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminShortRow = Omit<ShortCard, "liked" | "completed" | "likes"> & {
  status: MediaStatus;
  videoBytes: number;
  competencyId: string | null;
  courseId: string | null;
  views: number;
  completions: number;
  likes: number;
  updatedAt: string;
};

export type AdminDocumentRow = Omit<DocumentCard, "lastPage" | "completed"> & {
  status: MediaStatus;
  competencyId: string | null;
  courseId: string | null;
  readers: number;
  completions: number;
  updatedAt: string;
};

export type MediaOption = { id: string; nameEn: string; nameTh: string | null };

export type MediaAdminData = {
  shorts: AdminShortRow[];
  documents: AdminDocumentRow[];
  competencies: MediaOption[];
  courses: MediaOption[];
};

export type MediaResult =
  | { ok: true; message: Bilingual }
  | { ok: false; error: Bilingual };

/** 1.4 MB, 820 KB — for file sizes in lists and upload forms. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** 0:45, 2:05 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
