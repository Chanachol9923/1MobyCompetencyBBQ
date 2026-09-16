import type { Lang } from "@/lib/i18n";
import type { Audience, Channel, AnnouncementStatus } from "./types";

/**
 * Presentation helpers shared by the feed, the reader and the admin composer.
 * Pure functions that take the active language, so they work in a client
 * component and in the server-rendered first paint without a context.
 */

/** Database text is bilingual with Thai optional; English is the fallback. */
export function pick(lang: Lang, en: string, th?: string | null): string;
export function pick(lang: Lang, en: string | null, th?: string | null): string | null;
export function pick(lang: Lang, en: string | null, th?: string | null) {
  if (lang === "th" && th && th.trim()) return th;
  return en;
}

export function excerpt(text: string, max = 180) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * A fixed zone and calendar, so the server's first paint and the browser's
 * hydration produce the same characters.
 */
export function formatWhen(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH-u-ca-gregory" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/** Short relative form for the bell, which only renders after mount. */
export function timeAgo(iso: string, lang: Lang): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return lang === "th" ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === "th" ? `${hours} ชม.ที่แล้ว` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return lang === "th" ? `${days} วันที่แล้ว` : `${days}d ago`;
}

const AUDIENCE_COPY: Record<Audience, { en: string; th: string }> = {
  ALL: { en: "All employees", th: "พนักงานทั้งหมด" },
  DEPARTMENT: { en: "Department", th: "ฝ่าย" },
  DIVISION: { en: "Division", th: "แผนก" },
  JOB_ROLE: { en: "Career role", th: "ระดับตำแหน่ง" },
  PERSON: { en: "Person", th: "รายบุคคล" },
};

export const audienceKindLabel = (audience: Audience, lang: Lang) =>
  AUDIENCE_COPY[audience][lang];

/** "Department · Programming", or just "All employees". */
export function audienceLabel(
  audience: Audience,
  resolved: string | null,
  lang: Lang,
): string {
  const kind = audienceKindLabel(audience, lang);
  if (audience === "ALL" || !resolved) return kind;
  return `${kind} · ${resolved}`;
}

const CHANNEL_COPY: Record<Channel, { en: string; th: string }> = {
  IN_APP: { en: "In-app", th: "ในแอป" },
  EMAIL: { en: "Email", th: "อีเมล" },
  BOTH: { en: "In-app + email", th: "ในแอปและอีเมล" },
};

export const channelLabel = (channel: Channel, lang: Lang) => CHANNEL_COPY[channel][lang];

const STATUS_COPY: Record<AnnouncementStatus, { en: string; th: string }> = {
  DRAFT: { en: "Draft", th: "ฉบับร่าง" },
  PUBLISHED: { en: "Published", th: "เผยแพร่แล้ว" },
  ARCHIVED: { en: "Archived", th: "จัดเก็บแล้ว" },
};

/** A draft with a future publishAt reads as "Scheduled", not "Draft". */
export function statusLabel(
  status: AnnouncementStatus,
  publishAt: string | null,
  lang: Lang,
): string {
  if (status === "DRAFT" && publishAt && new Date(publishAt).getTime() > Date.now()) {
    return lang === "th" ? "ตั้งเวลาไว้" : "Scheduled";
  }
  return STATUS_COPY[status][lang];
}

/** Value for an `<input type="datetime-local">` from an ISO timestamp. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
