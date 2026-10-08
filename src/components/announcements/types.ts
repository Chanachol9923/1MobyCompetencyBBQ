/**
 * View models shared by the server queries in `src/server/announcements.ts` and
 * the client components that render them.
 *
 * Everything is plain data: the server never picks a language, it hands both
 * columns down and the client chooses with `useT()`.
 */

export type Audience = "ALL" | "DEPARTMENT" | "DIVISION" | "JOB_ROLE" | "PERSON";
export type Channel = "IN_APP" | "EMAIL" | "BOTH";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type NotificationKind =
  | "ASSESSMENT"
  | "IDP"
  | "LMS"
  | "REWARD"
  | "ANNOUNCEMENT"
  | "SYSTEM"
  | "PROBLEM";

/** One published announcement as an employee sees it. */
export type AnnouncementCard = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  bodyEn: string;
  bodyTh: string | null;
  audience: Audience;
  /** resolved name of the department / division / job role / person, null for ALL */
  audienceLabel: string | null;
  channel: Channel;
  pinned: boolean;
  /** ISO timestamp, null only for rows that have not been published */
  publishedAt: string | null;
  read: boolean;
};

export type AnnouncementFeed = {
  items: AnnouncementCard[];
  /** unread among everything addressed to this viewer, not just the filtered page */
  unreadCount: number;
  totalCount: number;
};

/** The same announcement from the admin side, with its unpublished state. */
export type AdminAnnouncementRow = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  bodyEn: string;
  bodyTh: string | null;
  audience: Audience;
  audienceRef: string | null;
  audienceLabel: string | null;
  channel: Channel;
  status: AnnouncementStatus;
  pinned: boolean;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  /** how many people have opened it */
  readCount: number;
};

export type AudienceOptions = {
  departments: { id: string; name: string }[];
  divisions: { id: string; name: string; departmentName: string }[];
  jobRoles: { id: string; name: string; level: string }[];
  employees: { id: string; name: string; email: string }[];
};

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  channel: Channel;
  titleEn: string;
  titleTh: string | null;
  bodyEn: string | null;
  bodyTh: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationFeed = {
  items: NotificationRow[];
  unreadCount: number;
};

export type NotificationRuleRow = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  channel: Channel;
  enabled: boolean;
};

/**
 * Server actions never throw for an expected validation failure — they return
 * this, with both languages, and the caller shows whichever one is active.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; errorEn: string; errorTh: string };
