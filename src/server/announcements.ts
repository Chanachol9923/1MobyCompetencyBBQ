"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import {
  assertPermission,
  assertViewer,
  recordActivity,
  type Viewer,
} from "@/server/session";
import type {
  ActionResult,
  AdminAnnouncementRow,
  AnnouncementCard,
  AnnouncementFeed,
  AudienceOptions,
  Audience,
  NotificationFeed,
  NotificationRuleRow,
} from "@/components/announcements/types";

/**
 * Announcements and the notification bell, against the database.
 *
 * Every export in this file is a server action, so every one of them starts
 * with a guard and resolves *who is asking* from the session. Nothing here
 * takes an employee id from the caller: an announcement id is checked against
 * the same audience filter the list uses, so a client that guesses an id of an
 * announcement addressed to someone else gets nothing back.
 */

/* ------------------------------------------------------------------ scope */

type Scope = {
  employeeId: string | null;
  departmentId: string | null;
  divisionId: string | null;
  jobRoleId: string | null;
};

const EMPTY_SCOPE: Scope = {
  employeeId: null,
  departmentId: null,
  divisionId: null,
  jobRoleId: null,
};

/**
 * The four things an announcement can be addressed to. Request-cached, so a
 * page that lists and then reads costs one lookup, not two.
 */
const scopeFor = cache(async (viewer: Viewer): Promise<Scope> => {
  if (!viewer.employeeId) return EMPTY_SCOPE;
  const employee = await db.employee.findUnique({
    where: { id: viewer.employeeId },
    select: { id: true, departmentId: true, divisionId: true, jobRoleId: true },
  });
  if (!employee) return EMPTY_SCOPE;
  return {
    employeeId: employee.id,
    departmentId: employee.departmentId,
    divisionId: employee.divisionId,
    jobRoleId: employee.jobRoleId,
  };
});

/**
 * "Published, and addressed to me." Expressed as SQL rather than filtered in
 * the browser, because the rows a person may not see must never leave the
 * server in the first place.
 */
function visibleWhere(scope: Scope): Prisma.AnnouncementWhereInput {
  const addressedToMe: Prisma.AnnouncementWhereInput[] = [{ audience: "ALL" }];
  if (scope.employeeId) {
    addressedToMe.push({ audience: "PERSON", audienceRef: scope.employeeId });
  }
  if (scope.departmentId) {
    addressedToMe.push({ audience: "DEPARTMENT", audienceRef: scope.departmentId });
  }
  if (scope.divisionId) {
    addressedToMe.push({ audience: "DIVISION", audienceRef: scope.divisionId });
  }
  if (scope.jobRoleId) {
    addressedToMe.push({ audience: "JOB_ROLE", audienceRef: scope.jobRoleId });
  }
  return {
    status: "PUBLISHED",
    publishedAt: { not: null, lte: new Date() },
    OR: addressedToMe,
  };
}

/* ------------------------------------------------------- audience labels */

type Labelled = { audience: Audience; audienceRef: string | null };

/**
 * Resolves "DEPARTMENT / cuid" into a name for a whole page of rows: at most
 * four extra queries whatever the row count, never one per row.
 */
async function audienceLabels(rows: Labelled[]): Promise<Map<string, string>> {
  const byKind: Record<Audience, Set<string>> = {
    ALL: new Set(),
    DEPARTMENT: new Set(),
    DIVISION: new Set(),
    JOB_ROLE: new Set(),
    PERSON: new Set(),
  };
  for (const row of rows) {
    if (row.audience !== "ALL" && row.audienceRef) {
      byKind[row.audience].add(row.audienceRef);
    }
  }

  const out = new Map<string, string>();
  const [departments, divisions, jobRoles, employees] = await Promise.all([
    byKind.DEPARTMENT.size
      ? db.department.findMany({
          where: { id: { in: [...byKind.DEPARTMENT] } },
          select: { id: true, name: true },
        })
      : [],
    byKind.DIVISION.size
      ? db.division.findMany({
          where: { id: { in: [...byKind.DIVISION] } },
          select: { id: true, name: true },
        })
      : [],
    byKind.JOB_ROLE.size
      ? db.jobRole.findMany({
          where: { id: { in: [...byKind.JOB_ROLE] } },
          select: { id: true, name: true },
        })
      : [],
    byKind.PERSON.size
      ? db.employee.findMany({
          where: { id: { in: [...byKind.PERSON] } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  for (const d of departments) out.set(`DEPARTMENT:${d.id}`, d.name);
  for (const d of divisions) out.set(`DIVISION:${d.id}`, d.name);
  for (const r of jobRoles) out.set(`JOB_ROLE:${r.id}`, r.name);
  for (const e of employees) out.set(`PERSON:${e.id}`, e.name);
  return out;
}

const labelOf = (labels: Map<string, string>, row: Labelled) =>
  row.audience === "ALL" || !row.audienceRef
    ? null
    : (labels.get(`${row.audience}:${row.audienceRef}`) ?? null);

/* ----------------------------------------------------- employee feed (1) */

const feedInput = z.object({
  filter: z.enum(["all", "unread"]).default("all"),
  q: z.string().trim().max(120).default(""),
});

export async function listMyAnnouncements(input: {
  filter?: "all" | "unread";
  q?: string;
}): Promise<AnnouncementFeed> {
  const viewer = await assertViewer();
  await releaseDueAnnouncements();
  const scope = await scopeFor(viewer);
  const parsed = feedInput.safeParse(input ?? {});
  const { filter, q } = parsed.success ? parsed.data : { filter: "all" as const, q: "" };

  const base = visibleWhere(scope);
  const search: Prisma.AnnouncementWhereInput = q
    ? {
        OR: [
          { titleEn: { contains: q, mode: "insensitive" } },
          { titleTh: { contains: q, mode: "insensitive" } },
          { bodyEn: { contains: q, mode: "insensitive" } },
          { bodyTh: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const unreadOnly: Prisma.AnnouncementWhereInput =
    filter === "unread" && scope.employeeId
      ? { reads: { none: { employeeId: scope.employeeId } } }
      : {};

  const [rows, totalCount, unreadCount] = await Promise.all([
    db.announcement.findMany({
      where: { AND: [base, search, unreadOnly] },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        titleEn: true,
        titleTh: true,
        bodyEn: true,
        bodyTh: true,
        audience: true,
        audienceRef: true,
        channel: true,
        pinned: true,
        publishedAt: true,
        // one extra query for the whole page, not one per row
        reads: {
          where: { employeeId: scope.employeeId ?? "" },
          select: { announcementId: true },
        },
      },
    }),
    db.announcement.count({ where: base }),
    scope.employeeId
      ? db.announcement.count({
          where: { AND: [base, { reads: { none: { employeeId: scope.employeeId } } }] },
        })
      : 0,
  ]);

  const labels = await audienceLabels(rows);

  return {
    items: rows.map((row) => ({
      id: row.id,
      titleEn: row.titleEn,
      titleTh: row.titleTh,
      bodyEn: row.bodyEn,
      bodyTh: row.bodyTh,
      audience: row.audience,
      audienceLabel: labelOf(labels, row),
      channel: row.channel,
      pinned: row.pinned,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      read: scope.employeeId ? row.reads.length > 0 : true,
    })),
    unreadCount,
    totalCount,
  };
}

/** One announcement, but only if it was addressed to this viewer. */
export async function getMyAnnouncement(id: string): Promise<AnnouncementCard | null> {
  const viewer = await assertViewer();
  const scope = await scopeFor(viewer);
  if (typeof id !== "string" || !id) return null;

  const row = await db.announcement.findFirst({
    // the id comes from the URL, so it is checked against the audience filter
    // rather than trusted
    where: { AND: [{ id }, visibleWhere(scope)] },
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      bodyEn: true,
      bodyTh: true,
      audience: true,
      audienceRef: true,
      channel: true,
      pinned: true,
      publishedAt: true,
      reads: {
        where: { employeeId: scope.employeeId ?? "" },
        select: { announcementId: true },
      },
    },
  });
  if (!row) return null;

  const labels = await audienceLabels([row]);
  return {
    id: row.id,
    titleEn: row.titleEn,
    titleTh: row.titleTh,
    bodyEn: row.bodyEn,
    bodyTh: row.bodyTh,
    audience: row.audience,
    audienceLabel: labelOf(labels, row),
    channel: row.channel,
    pinned: row.pinned,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    read: scope.employeeId ? row.reads.length > 0 : true,
  };
}

/** Records that this viewer opened an announcement. Idempotent. */
export async function markAnnouncementRead(id: string): Promise<ActionResult> {
  const viewer = await assertViewer();
  const scope = await scopeFor(viewer);
  if (typeof id !== "string" || !id) {
    return { ok: false, errorEn: "Unknown announcement.", errorTh: "ไม่พบประกาศนี้" };
  }
  // an account with no staff record (HROD) can read the feed but has nowhere
  // to hang a read receipt
  if (!scope.employeeId) return { ok: true, data: null };

  const visible = await db.announcement.findFirst({
    where: { AND: [{ id }, visibleWhere(scope)] },
    select: { id: true },
  });
  if (!visible) {
    return { ok: false, errorEn: "Unknown announcement.", errorTh: "ไม่พบประกาศนี้" };
  }

  await db.announcementRead.upsert({
    where: {
      announcementId_employeeId: { announcementId: id, employeeId: scope.employeeId },
    },
    update: {},
    create: { announcementId: id, employeeId: scope.employeeId },
  });
  revalidatePath("/announcements");
  return { ok: true, data: null };
}

/* ------------------------------------------------------ notifications (3) */

export async function listMyNotifications(): Promise<NotificationFeed> {
  const viewer = await assertViewer();
  await releaseDueAnnouncements();
  if (!viewer.employeeId) return { items: [], unreadCount: 0 };

  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { employeeId: viewer.employeeId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        channel: true,
        titleEn: true,
        titleTh: true,
        bodyEn: true,
        bodyTh: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { employeeId: viewer.employeeId, readAt: null } }),
  ]);

  return {
    items: rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      channel: n.channel,
      titleEn: n.titleEn,
      titleTh: n.titleTh,
      bodyEn: n.bodyEn,
      bodyTh: n.bodyTh,
      href: n.href,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const viewer = await assertViewer();
  if (!viewer.employeeId || typeof id !== "string" || !id) {
    return { ok: false, errorEn: "Unknown notification.", errorTh: "ไม่พบการแจ้งเตือนนี้" };
  }
  // scoped by employeeId, so an id belonging to someone else updates nothing
  const res = await db.notification.updateMany({
    where: { id, employeeId: viewer.employeeId, readAt: null },
    data: { readAt: new Date() },
  });
  if (res.count > 0) revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const viewer = await assertViewer();
  if (!viewer.employeeId) return { ok: true, data: null };
  // one statement for the whole inbox
  await db.notification.updateMany({
    where: { employeeId: viewer.employeeId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/* -------------------------------------------------------------- admin (2) */

const AUDIENCES = ["ALL", "DEPARTMENT", "DIVISION", "JOB_ROLE", "PERSON"] as const;
const CHANNELS = ["IN_APP", "EMAIL", "BOTH"] as const;

const draftFields = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleTh: z.string().trim().max(200).nullable().default(null),
  bodyEn: z.string().trim().min(1).max(8000),
  bodyTh: z.string().trim().max(8000).nullable().default(null),
  audience: z.enum(AUDIENCES),
  audienceRef: z.string().trim().nullable().default(null),
  channel: z.enum(CHANNELS),
  pinned: z.boolean().default(false),
  /** value of a datetime-local input; ignored when publishNow is true */
  publishAt: z.string().trim().nullable().default(null),
  publishNow: z.boolean().default(false),
});

/** A narrowed audience without a target would silently broadcast. */
const targetted = (d: { audience: Audience; audienceRef: string | null }) =>
  d.audience === "ALL" || Boolean(d.audienceRef);

const draftSchema = draftFields.refine(targetted, { message: "audienceRef" });
const updateSchema = draftFields
  .extend({ id: z.string().trim().min(1) })
  .refine(targetted, { message: "audienceRef" });

type Draft = z.infer<typeof draftFields>;

const invalid = (errorEn: string, errorTh: string): ActionResult<never> => ({
  ok: false,
  errorEn,
  errorTh,
});

const BAD_INPUT = invalid(
  "Title and message are required, and a narrowed audience needs a target.",
  "ต้องกรอกหัวข้อและข้อความ และหากเลือกกลุ่มผู้รับแบบเจาะจงต้องระบุเป้าหมายด้วย",
);

/** Confirms the audience target actually exists before it is stored. */
async function audienceExists(audience: Audience, ref: string | null): Promise<boolean> {
  if (audience === "ALL") return true;
  if (!ref) return false;
  const count =
    audience === "DEPARTMENT"
      ? await db.department.count({ where: { id: ref } })
      : audience === "DIVISION"
        ? await db.division.count({ where: { id: ref } })
        : audience === "JOB_ROLE"
          ? await db.jobRole.count({ where: { id: ref } })
          : await db.employee.count({ where: { id: ref } });
  return count > 0;
}

/** Everyone an announcement is addressed to, as ids, in one query. */
async function audienceEmployeeIds(
  audience: Audience,
  ref: string | null,
): Promise<string[]> {
  if (audience !== "ALL" && !ref) return [];
  const where: Prisma.EmployeeWhereInput = { active: true };
  if (audience === "DEPARTMENT") where.departmentId = ref!;
  else if (audience === "DIVISION") where.divisionId = ref!;
  else if (audience === "JOB_ROLE") where.jobRoleId = ref!;
  else if (audience === "PERSON") where.id = ref!;
  const rows = await db.employee.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

type Publishable = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  bodyEn: string;
  bodyTh: string | null;
  audience: Audience;
  audienceRef: string | null;
  channel: "IN_APP" | "EMAIL" | "BOTH";
};

/**
 * The fan-out. One `createMany` for the whole audience — a loop of inserts is
 * what makes an announcement to 22 people 22 round trips.
 */
async function fanOut(a: Publishable): Promise<number> {
  const ids = await audienceEmployeeIds(a.audience, a.audienceRef);
  if (ids.length === 0) return 0;
  const excerpt = (s: string | null) =>
    s === null ? null : s.length > 240 ? `${s.slice(0, 237)}…` : s;
  await db.notification.createMany({
    data: ids.map((employeeId) => ({
      employeeId,
      kind: "ANNOUNCEMENT" as const,
      channel: a.channel,
      titleEn: a.titleEn,
      titleTh: a.titleTh,
      bodyEn: excerpt(a.bodyEn),
      bodyTh: excerpt(a.bodyTh),
      // notifications deep-link to the announcement, which is why the reader
      // needs a linkable route
      href: `/announcements/${a.id}`,
    })),
  });
  return ids.length;
}

/**
 * Scheduled announcements go out on their own. There is no background job:
 * whenever someone opens the feed, the bell or the manage screen, anything
 * whose publish time has passed is published and its notifications sent. The
 * status flip is conditional, so two requests arriving together cannot both
 * win and notify everyone twice.
 */
async function releaseDueAnnouncements(): Promise<void> {
  const due = await db.announcement.findMany({
    where: { status: "DRAFT", publishAt: { not: null, lte: new Date() } },
    select: {
      id: true,
      publishAt: true,
      titleEn: true,
      titleTh: true,
      bodyEn: true,
      bodyTh: true,
      audience: true,
      audienceRef: true,
      channel: true,
    },
  });
  for (const row of due) {
    const claimed = await db.announcement.updateMany({
      where: { id: row.id, status: "DRAFT", publishAt: row.publishAt },
      data: { status: "PUBLISHED", publishedAt: row.publishAt, publishAt: null },
    });
    if (claimed.count !== 1) continue;
    const notified = await fanOut(row);
    await recordActivity({
      viewer: null,
      action: "Published announcement",
      targetType: "announcement",
      targetId: row.id,
      targetLabel: row.titleEn,
      detail: `scheduled · ${row.audience} · ${row.channel} · notified ${notified}`,
    });
  }
}

function revalidateAnnouncements() {
  revalidatePath("/announcements");
  // the bell lives in the shell
  revalidatePath("/", "layout");
}

/** Scheduled means "in the future": everything else publishes immediately. */
function scheduleOf(draft: Draft): { publishAt: Date | null; publish: boolean } {
  if (draft.publishNow) return { publishAt: null, publish: true };
  if (!draft.publishAt?.trim()) return { publishAt: null, publish: false };
  const when = new Date(draft.publishAt);
  if (Number.isNaN(when.getTime())) return { publishAt: null, publish: false };
  return { publishAt: when, publish: when.getTime() <= Date.now() };
}

export async function listAnnouncementsForAdmin(): Promise<AdminAnnouncementRow[]> {
  await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  await releaseDueAnnouncements();
  const rows = await db.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      bodyEn: true,
      bodyTh: true,
      audience: true,
      audienceRef: true,
      channel: true,
      status: true,
      pinned: true,
      publishAt: true,
      publishedAt: true,
      createdAt: true,
      _count: { select: { reads: true } },
    },
  });
  const labels = await audienceLabels(rows);
  return rows.map((row) => ({
    id: row.id,
    titleEn: row.titleEn,
    titleTh: row.titleTh,
    bodyEn: row.bodyEn,
    bodyTh: row.bodyTh,
    audience: row.audience,
    audienceRef: row.audienceRef,
    audienceLabel: labelOf(labels, row),
    channel: row.channel,
    status: row.status,
    pinned: row.pinned,
    publishAt: row.publishAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    readCount: row._count.reads,
  }));
}

/** The real org structure, for the audience picker. */
export async function getAudienceOptions(): Promise<AudienceOptions> {
  await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  const [departments, divisions, jobRoles, employees] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.division.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, department: { select: { name: true } } },
    }),
    db.jobRole.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, level: true },
    }),
    db.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return {
    departments,
    divisions: divisions.map((d) => ({
      id: d.id,
      name: d.name,
      departmentName: d.department.name,
    })),
    jobRoles,
    employees,
  };
}

/** Read-only for now: the rules are seeded, editing them is a later screen. */
export async function listNotificationRules(): Promise<NotificationRuleRow[]> {
  await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  return db.notificationRule.findMany({
    orderBy: { key: "asc" },
    select: { id: true, key: true, nameEn: true, nameTh: true, channel: true, enabled: true },
  });
}

export async function createAnnouncement(
  input: unknown,
): Promise<ActionResult<{ id: string; published: boolean; notified: number }>> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  const draft = parsed.data;
  const ref = draft.audience === "ALL" ? null : draft.audienceRef;
  if (!(await audienceExists(draft.audience, ref))) {
    return invalid("That audience no longer exists.", "ไม่พบกลุ่มผู้รับที่เลือก");
  }

  const { publishAt, publish } = scheduleOf(draft);
  const created = await db.announcement.create({
    data: {
      titleEn: draft.titleEn,
      titleTh: draft.titleTh || null,
      bodyEn: draft.bodyEn,
      bodyTh: draft.bodyTh || null,
      audience: draft.audience,
      audienceRef: ref,
      channel: draft.channel,
      pinned: draft.pinned,
      // a future publishAt keeps the row a draft and notifies nobody
      status: publish ? "PUBLISHED" : "DRAFT",
      publishAt,
      publishedAt: publish ? new Date() : null,
      createdById: viewer.employeeId,
    },
    select: { id: true },
  });

  const notified = publish
    ? await fanOut({
        id: created.id,
        titleEn: draft.titleEn,
        titleTh: draft.titleTh || null,
        bodyEn: draft.bodyEn,
        bodyTh: draft.bodyTh || null,
        audience: draft.audience,
        audienceRef: ref,
        channel: draft.channel,
      })
    : 0;

  await recordActivity({
    viewer,
    action: publish ? "Published announcement" : "Created announcement draft",
    targetType: "announcement",
    targetId: created.id,
    targetLabel: draft.titleEn,
    detail: publish
      ? `${draft.audience} · ${draft.channel} · notified ${notified}`
      : `${draft.audience} · ${draft.channel} · ${publishAt ? `scheduled ${publishAt.toISOString()}` : "draft"}`,
  });
  revalidateAnnouncements();
  return { ok: true, data: { id: created.id, published: publish, notified } };
}

export async function updateAnnouncement(
  input: unknown,
): Promise<ActionResult<{ id: string; published: boolean; notified: number }>> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  const draft = parsed.data;

  const existing = await db.announcement.findUnique({
    where: { id: draft.id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!existing) {
    return invalid("That announcement no longer exists.", "ไม่พบประกาศนี้แล้ว");
  }
  const ref = draft.audience === "ALL" ? null : draft.audienceRef;
  if (!(await audienceExists(draft.audience, ref))) {
    return invalid("That audience no longer exists.", "ไม่พบกลุ่มผู้รับที่เลือก");
  }

  const wasPublished = existing.status === "PUBLISHED";
  const { publishAt, publish } = scheduleOf(draft);
  // editing a published announcement never re-notifies; only the transition does
  const nowPublished = wasPublished || publish;

  await db.announcement.update({
    where: { id: draft.id },
    data: {
      titleEn: draft.titleEn,
      titleTh: draft.titleTh || null,
      bodyEn: draft.bodyEn,
      bodyTh: draft.bodyTh || null,
      audience: draft.audience,
      audienceRef: ref,
      channel: draft.channel,
      pinned: draft.pinned,
      status: nowPublished ? "PUBLISHED" : "DRAFT",
      publishAt,
      publishedAt: nowPublished ? (existing.publishedAt ?? new Date()) : null,
    },
  });

  const notified =
    !wasPublished && publish
      ? await fanOut({
          id: draft.id,
          titleEn: draft.titleEn,
          titleTh: draft.titleTh || null,
          bodyEn: draft.bodyEn,
          bodyTh: draft.bodyTh || null,
          audience: draft.audience,
          audienceRef: ref,
          channel: draft.channel,
        })
      : 0;

  await recordActivity({
    viewer,
    action:
      !wasPublished && publish ? "Published announcement" : "Updated announcement",
    targetType: "announcement",
    targetId: draft.id,
    targetLabel: draft.titleEn,
    detail: `${draft.audience} · ${draft.channel}${notified ? ` · notified ${notified}` : ""}`,
  });
  revalidateAnnouncements();
  return { ok: true, data: { id: draft.id, published: nowPublished, notified } };
}

/** Publishes a draft right now, which is what fans the notifications out. */
export async function publishAnnouncementNow(
  id: string,
): Promise<ActionResult<{ notified: number }>> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  if (typeof id !== "string" || !id) {
    return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  }
  const row = await db.announcement.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      titleEn: true,
      titleTh: true,
      bodyEn: true,
      bodyTh: true,
      audience: true,
      audienceRef: true,
      channel: true,
    },
  });
  if (!row) return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  if (row.status === "PUBLISHED") {
    return invalid("That announcement is already published.", "ประกาศนี้เผยแพร่ไปแล้ว");
  }

  await db.announcement.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), publishAt: null },
  });
  const notified = await fanOut(row);

  await recordActivity({
    viewer,
    action: "Published announcement",
    targetType: "announcement",
    targetId: id,
    targetLabel: row.titleEn,
    detail: `${row.audience} · ${row.channel} · notified ${notified}`,
  });
  revalidateAnnouncements();
  return { ok: true, data: { notified } };
}

/** Takes it back off the feed. Notifications already delivered stay put. */
export async function unpublishAnnouncement(id: string): Promise<ActionResult> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  if (typeof id !== "string" || !id) {
    return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  }
  const row = await db.announcement.findUnique({
    where: { id },
    select: { id: true, titleEn: true, status: true },
  });
  if (!row) return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  if (row.status !== "PUBLISHED") {
    return invalid("That announcement is not published.", "ประกาศนี้ยังไม่ได้เผยแพร่");
  }

  await db.announcement.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
  });
  await recordActivity({
    viewer,
    action: "Unpublished announcement",
    targetType: "announcement",
    targetId: id,
    targetLabel: row.titleEn,
  });
  revalidateAnnouncements();
  return { ok: true, data: null };
}

export async function setAnnouncementPinned(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  if (typeof id !== "string" || !id || typeof pinned !== "boolean") {
    return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  }
  const row = await db.announcement.findUnique({
    where: { id },
    select: { id: true, titleEn: true },
  });
  if (!row) return invalid("Unknown announcement.", "ไม่พบประกาศนี้");

  await db.announcement.update({ where: { id }, data: { pinned } });
  await recordActivity({
    viewer,
    action: pinned ? "Pinned announcement" : "Unpinned announcement",
    targetType: "announcement",
    targetId: id,
    targetLabel: row.titleEn,
  });
  revalidateAnnouncements();
  return { ok: true, data: null };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const viewer = await assertPermission(PERMISSIONS.SEND_ANNOUNCEMENTS);
  if (typeof id !== "string" || !id) {
    return invalid("Unknown announcement.", "ไม่พบประกาศนี้");
  }
  const row = await db.announcement.findUnique({
    where: { id },
    select: { id: true, titleEn: true },
  });
  if (!row) return invalid("Unknown announcement.", "ไม่พบประกาศนี้");

  // reads cascade with the announcement; delivered notifications do not, they
  // are a record of something that really was sent
  await db.announcement.delete({ where: { id } });
  await recordActivity({
    viewer,
    action: "Deleted announcement",
    targetType: "announcement",
    targetId: id,
    targetLabel: row.titleEn,
  });
  revalidateAnnouncements();
  return { ok: true, data: null };
}
