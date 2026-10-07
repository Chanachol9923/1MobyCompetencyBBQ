"use server";

/**
 * Shorts and documents: the two learning formats that sit beside courses.
 *
 * Employees read and record their own progress (the employee id always comes
 * from the session). Administrators with `manage_lms` publish, edit and delete;
 * the files themselves were already uploaded straight to Vercel Blob by the
 * browser, so these actions only ever store a URL — and only a URL from our
 * own Blob store, never an arbitrary link.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { BLOB_URL, removeBlobs } from "@/server/blob";
import { PERMISSIONS } from "@/lib/permissions";
import {
  assertEmployee,
  assertPermission,
  NotAuthorised,
  recordActivity,
  type Viewer,
} from "@/server/session";
import {
  LMS_POINTS,
  MEDIA_LIMITS,
  POINT_REASON,
  POINT_REF,
} from "@/components/learning/model";
import type {
  AdminDocumentRow,
  AdminShortRow,
  DocumentCard,
  MediaAdminData,
  MediaResult,
  ShortCard,
} from "@/components/learning/media-types";

/* ---------------------------------------------------------------- plumbing */

const msg = (en: string, th: string) => ({ en, th });
const fail = (en: string, th: string): MediaResult => ({ ok: false, error: msg(en, th) });
const done = (en: string, th: string): MediaResult => ({ ok: true, message: msg(en, th) });

function revalidateMedia() {
  revalidatePath("/lms");
  revalidatePath("/lms/shorts");
  revalidatePath("/lms/documents");
  revalidatePath("/admin/lms");
}

/** Only files from our own Blob store may be saved against a record. */
const blobUrl = z.string().url().max(600).regex(BLOB_URL);

async function guarded(run: (viewer: Viewer) => Promise<MediaResult>): Promise<MediaResult> {
  try {
    const viewer = await assertPermission(PERMISSIONS.MANAGE_LMS);
    return await run(viewer);
  } catch (err) {
    if (err instanceof NotAuthorised) return fail(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้");
    throw err;
  }
}

/** Award once — the partial unique index makes a racing second award fail. */
async function awardOnce(employeeId: string, refType: string, refId: string, delta: number, reason: string) {
  try {
    await db.pointLedger.create({ data: { employeeId, delta, reason, refType, refId } });
    return delta;
  } catch {
    return 0;
  }
}

const refs = {
  competency: { select: { nameEn: true, nameTh: true } },
  course: { select: { slug: true, titleEn: true, titleTh: true } },
} as const;

/* ======================================================= employee: shorts */

export async function getShortsFeed(): Promise<{ shorts: ShortCard[] }> {
  const viewer = await assertEmployee();
  const rows = await db.shortVideo.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      captionEn: true,
      captionTh: true,
      videoUrl: true,
      posterUrl: true,
      durationSec: true,
      ...refs,
      views: { where: { employeeId: viewer.employeeId }, select: { completedAt: true, liked: true } },
      _count: { select: { views: { where: { liked: true } } } },
    },
  });
  const shorts = rows.map((r) => ({
    id: r.id,
    titleEn: r.titleEn,
    titleTh: r.titleTh,
    captionEn: r.captionEn,
    captionTh: r.captionTh,
    videoUrl: r.videoUrl,
    posterUrl: r.posterUrl,
    durationSec: r.durationSec,
    competency: r.competency,
    course: r.course,
    likes: r._count.views,
    liked: r.views[0]?.liked ?? false,
    completed: Boolean(r.views[0]?.completedAt),
  }));
  // what you have not finished first, newest first within each group
  shorts.sort((a, b) => Number(a.completed) - Number(b.completed));
  return { shorts };
}

const progressSchema = z.object({ shortId: z.string().min(1).max(64), completed: z.boolean() });

/** Seen, and — once — watched to the end, which pays a few points. */
export async function recordShortProgress(
  input: z.input<typeof progressSchema>,
): Promise<{ points: number }> {
  const viewer = await assertEmployee();
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { points: 0 };
  const { shortId, completed } = parsed.data;
  const short = await db.shortVideo.findFirst({
    where: { id: shortId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!short) return { points: 0 };

  await db.shortView.upsert({
    where: { shortId_employeeId: { shortId, employeeId: viewer.employeeId } },
    create: { shortId, employeeId: viewer.employeeId },
    update: {},
  });
  if (!completed) return { points: 0 };

  const claimed = await db.shortView.updateMany({
    where: { shortId, employeeId: viewer.employeeId, completedAt: null },
    data: { completedAt: new Date() },
  });
  if (claimed.count === 0) return { points: 0 };
  const points = await awardOnce(
    viewer.employeeId,
    POINT_REF.short,
    shortId,
    LMS_POINTS.short,
    POINT_REASON.short,
  );
  revalidatePath("/reward");
  return { points };
}

const likeSchema = z.object({ shortId: z.string().min(1).max(64), liked: z.boolean() });

export async function setShortLike(input: z.input<typeof likeSchema>): Promise<{ likes: number }> {
  const viewer = await assertEmployee();
  const parsed = likeSchema.safeParse(input);
  if (!parsed.success) return { likes: 0 };
  const { shortId, liked } = parsed.data;
  const short = await db.shortVideo.findFirst({ where: { id: shortId, status: "PUBLISHED" }, select: { id: true } });
  if (!short) return { likes: 0 };
  await db.shortView.upsert({
    where: { shortId_employeeId: { shortId, employeeId: viewer.employeeId } },
    create: { shortId, employeeId: viewer.employeeId, liked },
    update: { liked },
  });
  const likes = await db.shortView.count({ where: { shortId, liked: true } });
  return { likes };
}

/* ==================================================== employee: documents */

function toDocumentCard(
  r: {
    id: string;
    titleEn: string;
    titleTh: string | null;
    descriptionEn: string | null;
    descriptionTh: string | null;
    fileUrl: string;
    fileBytes: number;
    pages: number;
    publishedAt: Date | null;
    competency: { nameEn: string; nameTh: string | null } | null;
    course: { slug: string; titleEn: string; titleTh: string | null } | null;
  },
  read: { lastPage: number; completedAt: Date | null } | undefined,
): DocumentCard {
  return {
    id: r.id,
    titleEn: r.titleEn,
    titleTh: r.titleTh,
    descriptionEn: r.descriptionEn,
    descriptionTh: r.descriptionTh,
    fileUrl: r.fileUrl,
    fileBytes: r.fileBytes,
    pages: r.pages,
    competency: r.competency,
    course: r.course,
    lastPage: Math.min(read?.lastPage ?? 1, r.pages),
    completed: Boolean(read?.completedAt),
    publishedAt: r.publishedAt?.toISOString() ?? null,
  };
}

const DOC_SELECT = {
  id: true,
  titleEn: true,
  titleTh: true,
  descriptionEn: true,
  descriptionTh: true,
  fileUrl: true,
  fileBytes: true,
  pages: true,
  publishedAt: true,
  ...refs,
} as const;

export async function listDocuments(): Promise<{ documents: DocumentCard[] }> {
  const viewer = await assertEmployee();
  const rows = await db.learningDocument.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      ...DOC_SELECT,
      reads: { where: { employeeId: viewer.employeeId }, select: { lastPage: true, completedAt: true } },
    },
  });
  return { documents: rows.map((r) => toDocumentCard(r, r.reads[0])) };
}

export async function getDocument(id: string): Promise<DocumentCard | null> {
  const viewer = await assertEmployee();
  if (typeof id !== "string" || id.length > 64) return null;
  const r = await db.learningDocument.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      ...DOC_SELECT,
      reads: { where: { employeeId: viewer.employeeId }, select: { lastPage: true, completedAt: true } },
    },
  });
  return r ? toDocumentCard(r, r.reads[0]) : null;
}

const pageSchema = z.object({
  documentId: z.string().min(1).max(64),
  page: z.number().int().min(1).max(10000),
});

/** Remember the page; reaching the last one finishes the document, once. */
export async function saveDocumentPage(
  input: z.input<typeof pageSchema>,
): Promise<{ completed: boolean; points: number }> {
  const viewer = await assertEmployee();
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { completed: false, points: 0 };
  const doc = await db.learningDocument.findFirst({
    where: { id: parsed.data.documentId, status: "PUBLISHED" },
    select: { id: true, pages: true },
  });
  if (!doc) return { completed: false, points: 0 };
  const page = Math.min(parsed.data.page, doc.pages);

  await db.documentRead.upsert({
    where: { documentId_employeeId: { documentId: doc.id, employeeId: viewer.employeeId } },
    create: { documentId: doc.id, employeeId: viewer.employeeId, lastPage: page },
    update: { lastPage: page },
  });
  if (page < doc.pages) return { completed: false, points: 0 };

  const claimed = await db.documentRead.updateMany({
    where: { documentId: doc.id, employeeId: viewer.employeeId, completedAt: null },
    data: { completedAt: new Date() },
  });
  if (claimed.count === 0) return { completed: true, points: 0 };
  const points = await awardOnce(
    viewer.employeeId,
    POINT_REF.document,
    doc.id,
    LMS_POINTS.document,
    POINT_REASON.document,
  );
  revalidatePath("/lms/documents");
  revalidatePath("/reward");
  return { completed: true, points };
}

/* ================================================================= admin */

export async function getMediaAdminData(): Promise<MediaAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_LMS);
  const [shorts, documents, competencies, courses, likeCounts, completedShorts, completedDocs] =
    await Promise.all([
      db.shortVideo.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          titleEn: true,
          titleTh: true,
          captionEn: true,
          captionTh: true,
          videoUrl: true,
          posterUrl: true,
          videoBytes: true,
          durationSec: true,
          status: true,
          competencyId: true,
          courseId: true,
          updatedAt: true,
          ...refs,
          _count: { select: { views: true } },
        },
      }),
      db.learningDocument.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          ...DOC_SELECT,
          status: true,
          competencyId: true,
          courseId: true,
          updatedAt: true,
          _count: { select: { reads: true } },
        },
      }),
      db.competency.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, nameEn: true, nameTh: true } }),
      db.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { titleEn: "asc" },
        select: { id: true, titleEn: true, titleTh: true },
      }),
      db.shortView.groupBy({ by: ["shortId"], where: { liked: true }, _count: { _all: true } }),
      db.shortView.groupBy({ by: ["shortId"], where: { completedAt: { not: null } }, _count: { _all: true } }),
      db.documentRead.groupBy({ by: ["documentId"], where: { completedAt: { not: null } }, _count: { _all: true } }),
    ]);
  const likes = new Map(likeCounts.map((g) => [g.shortId, g._count._all]));
  const finished = new Map(completedShorts.map((g) => [g.shortId, g._count._all]));
  const docsFinished = new Map(completedDocs.map((g) => [g.documentId, g._count._all]));

  return {
    shorts: shorts.map(
      (s): AdminShortRow => ({
        id: s.id,
        titleEn: s.titleEn,
        titleTh: s.titleTh,
        captionEn: s.captionEn,
        captionTh: s.captionTh,
        videoUrl: s.videoUrl,
        posterUrl: s.posterUrl,
        videoBytes: s.videoBytes,
        durationSec: s.durationSec,
        status: s.status,
        competencyId: s.competencyId,
        courseId: s.courseId,
        competency: s.competency,
        course: s.course,
        views: s._count.views,
        completions: finished.get(s.id) ?? 0,
        likes: likes.get(s.id) ?? 0,
        updatedAt: s.updatedAt.toISOString(),
      }),
    ),
    documents: documents.map(
      (d): AdminDocumentRow => ({
        ...toDocumentCard(d, undefined),
        status: d.status,
        competencyId: d.competencyId,
        courseId: d.courseId,
        readers: d._count.reads,
        completions: docsFinished.get(d.id) ?? 0,
        updatedAt: d.updatedAt.toISOString(),
      }),
    ),
    competencies,
    courses: courses.map((c) => ({ id: c.id, nameEn: c.titleEn, nameTh: c.titleTh })),
  };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const shortSchema = z.object({
  id: z.string().max(64).optional().default(""),
  titleEn: z.string().trim().min(1).max(120),
  titleTh: optionalText(120),
  captionEn: optionalText(500),
  captionTh: optionalText(500),
  videoUrl: blobUrl,
  posterUrl: blobUrl.nullable().optional().default(null),
  videoBytes: z.number().int().min(0).max(MEDIA_LIMITS.video.maxMB * 1024 * 1024),
  durationSec: z.number().int().min(1).max(MEDIA_LIMITS.shortMaxSeconds),
  competencyId: z.string().max(64).optional().default(""),
  courseId: z.string().max(64).optional().default(""),
  publish: z.boolean(),
});

export async function saveShort(input: z.input<typeof shortSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = shortSchema.safeParse(input);
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some((i) => i.path[0] === "durationSec");
      return tooLong
        ? fail(
            `A short can be at most ${MEDIA_LIMITS.shortMaxSeconds / 60} minutes. Put longer videos in a course chapter.`,
            `วิดีโอสั้นยาวได้ไม่เกิน ${MEDIA_LIMITS.shortMaxSeconds / 60} นาที วิดีโอที่ยาวกว่านี้ให้ใส่เป็นบทเรียนในหลักสูตร`,
          )
        : fail("Add a title and a video.", "กรุณาใส่ชื่อและวิดีโอ");
    }
    const d = parsed.data;
    const existing = d.id
      ? await db.shortVideo.findUnique({
          where: { id: d.id },
          select: { id: true, status: true, publishedAt: true, videoUrl: true, posterUrl: true },
        })
      : null;
    if (d.id && !existing) return fail("That short no longer exists.", "ไม่พบวิดีโอสั้นนี้แล้ว");

    const data = {
      titleEn: d.titleEn,
      titleTh: d.titleTh,
      captionEn: d.captionEn,
      captionTh: d.captionTh,
      videoUrl: d.videoUrl,
      posterUrl: d.posterUrl ?? null,
      videoBytes: d.videoBytes,
      durationSec: d.durationSec,
      competencyId: d.competencyId || null,
      courseId: d.courseId || null,
      status: d.publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
      publishedAt: d.publish ? (existing?.publishedAt ?? new Date()) : null,
    };
    const row = existing
      ? await db.shortVideo.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.shortVideo.create({ data: { ...data, createdById: viewer.userId }, select: { id: true } });

    // a replaced video or poster is no longer referenced by anything
    if (existing) {
      await removeBlobs([
        existing.videoUrl !== d.videoUrl ? existing.videoUrl : null,
        existing.posterUrl && existing.posterUrl !== d.posterUrl ? existing.posterUrl : null,
      ]);
    }
    await recordActivity({
      viewer,
      action: existing ? "Updated short" : "Uploaded short",
      targetType: "short",
      targetId: row.id,
      targetLabel: d.titleEn,
      detail: d.publish ? "published" : "draft",
    });
    revalidateMedia();
    return d.publish
      ? done(`"${d.titleEn}" is live in Shorts.`, `เผยแพร่ "${d.titleTh ?? d.titleEn}" ใน Shorts แล้ว`)
      : done(`"${d.titleEn}" saved as a draft.`, `บันทึก "${d.titleTh ?? d.titleEn}" เป็นฉบับร่างแล้ว`);
  });
}

const statusSchema = z.object({ id: z.string().min(1).max(64), publish: z.boolean() });

export async function setShortPublished(input: z.input<typeof statusSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown short.", "ไม่พบวิดีโอสั้นที่ระบุ");
    const row = await db.shortVideo.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, titleEn: true, titleTh: true, publishedAt: true },
    });
    if (!row) return fail("That short no longer exists.", "ไม่พบวิดีโอสั้นนี้แล้ว");
    const publish = parsed.data.publish;
    await db.shortVideo.update({
      where: { id: row.id },
      data: {
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? (row.publishedAt ?? new Date()) : null,
      },
    });
    await recordActivity({
      viewer,
      action: publish ? "Published short" : "Unpublished short",
      targetType: "short",
      targetId: row.id,
      targetLabel: row.titleEn,
    });
    revalidateMedia();
    return publish
      ? done(`"${row.titleEn}" is live in Shorts.`, `เผยแพร่ "${row.titleTh ?? row.titleEn}" แล้ว`)
      : done(`"${row.titleEn}" is hidden from Shorts.`, `ซ่อน "${row.titleTh ?? row.titleEn}" จาก Shorts แล้ว`);
  });
}

const idSchema = z.object({ id: z.string().min(1).max(64) });

export async function deleteShort(input: z.input<typeof idSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown short.", "ไม่พบวิดีโอสั้นที่ระบุ");
    const row = await db.shortVideo.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, titleEn: true, titleTh: true, videoUrl: true, posterUrl: true },
    });
    if (!row) return fail("That short no longer exists.", "ไม่พบวิดีโอสั้นนี้แล้ว");
    await db.shortVideo.delete({ where: { id: row.id } });
    await removeBlobs([row.videoUrl, row.posterUrl]);
    await recordActivity({
      viewer,
      action: "Deleted short",
      targetType: "short",
      targetId: row.id,
      targetLabel: row.titleEn,
    });
    revalidateMedia();
    return done(`"${row.titleEn}" deleted.`, `ลบ "${row.titleTh ?? row.titleEn}" แล้ว`);
  });
}

const documentSchema = z.object({
  id: z.string().max(64).optional().default(""),
  titleEn: z.string().trim().min(1).max(160),
  titleTh: optionalText(160),
  descriptionEn: optionalText(800),
  descriptionTh: optionalText(800),
  fileUrl: blobUrl,
  fileBytes: z.number().int().min(0).max(MEDIA_LIMITS.pdf.maxMB * 1024 * 1024),
  pages: z.number().int().min(1).max(5000),
  competencyId: z.string().max(64).optional().default(""),
  courseId: z.string().max(64).optional().default(""),
  publish: z.boolean(),
});

export async function saveDocument(input: z.input<typeof documentSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = documentSchema.safeParse(input);
    if (!parsed.success) return fail("Add a title and a PDF.", "กรุณาใส่ชื่อและไฟล์ PDF");
    const d = parsed.data;
    const existing = d.id
      ? await db.learningDocument.findUnique({
          where: { id: d.id },
          select: { id: true, publishedAt: true, fileUrl: true, pages: true },
        })
      : null;
    if (d.id && !existing) return fail("That document no longer exists.", "ไม่พบเอกสารนี้แล้ว");

    const data = {
      titleEn: d.titleEn,
      titleTh: d.titleTh,
      descriptionEn: d.descriptionEn,
      descriptionTh: d.descriptionTh,
      fileUrl: d.fileUrl,
      fileBytes: d.fileBytes,
      pages: d.pages,
      competencyId: d.competencyId || null,
      courseId: d.courseId || null,
      status: d.publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
      publishedAt: d.publish ? (existing?.publishedAt ?? new Date()) : null,
    };
    const row = existing
      ? await db.learningDocument.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.learningDocument.create({ data: { ...data, createdById: viewer.userId }, select: { id: true } });

    if (existing && existing.fileUrl !== d.fileUrl) {
      await removeBlobs([existing.fileUrl]);
      // a new file is a new document to read: nobody's old page applies to it
      await db.documentRead.updateMany({ where: { documentId: existing.id }, data: { lastPage: 1 } });
    }
    await recordActivity({
      viewer,
      action: existing ? "Updated document" : "Uploaded document",
      targetType: "document",
      targetId: row.id,
      targetLabel: d.titleEn,
      detail: `${d.pages} pages · ${d.publish ? "published" : "draft"}`,
    });
    revalidateMedia();
    return d.publish
      ? done(`"${d.titleEn}" is in the document library.`, `เผยแพร่ "${d.titleTh ?? d.titleEn}" ในคลังเอกสารแล้ว`)
      : done(`"${d.titleEn}" saved as a draft.`, `บันทึก "${d.titleTh ?? d.titleEn}" เป็นฉบับร่างแล้ว`);
  });
}

export async function setDocumentPublished(input: z.input<typeof statusSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown document.", "ไม่พบเอกสารที่ระบุ");
    const row = await db.learningDocument.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, titleEn: true, titleTh: true, publishedAt: true },
    });
    if (!row) return fail("That document no longer exists.", "ไม่พบเอกสารนี้แล้ว");
    const publish = parsed.data.publish;
    await db.learningDocument.update({
      where: { id: row.id },
      data: {
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? (row.publishedAt ?? new Date()) : null,
      },
    });
    await recordActivity({
      viewer,
      action: publish ? "Published document" : "Unpublished document",
      targetType: "document",
      targetId: row.id,
      targetLabel: row.titleEn,
    });
    revalidateMedia();
    return publish
      ? done(`"${row.titleEn}" is in the document library.`, `เผยแพร่ "${row.titleTh ?? row.titleEn}" แล้ว`)
      : done(`"${row.titleEn}" is hidden from the library.`, `ซ่อน "${row.titleTh ?? row.titleEn}" จากคลังเอกสารแล้ว`);
  });
}

export async function deleteDocument(input: z.input<typeof idSchema>): Promise<MediaResult> {
  return guarded(async (viewer) => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown document.", "ไม่พบเอกสารที่ระบุ");
    const row = await db.learningDocument.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, titleEn: true, titleTh: true, fileUrl: true },
    });
    if (!row) return fail("That document no longer exists.", "ไม่พบเอกสารนี้แล้ว");
    await db.learningDocument.delete({ where: { id: row.id } });
    await removeBlobs([row.fileUrl]);
    await recordActivity({
      viewer,
      action: "Deleted document",
      targetType: "document",
      targetId: row.id,
      targetLabel: row.titleEn,
    });
    revalidateMedia();
    return done(`"${row.titleEn}" deleted.`, `ลบ "${row.titleTh ?? row.titleEn}" แล้ว`);
  });
}

/** A chapter file that was replaced or removed in the course editor. */
export async function discardUpload(input: { url: string }): Promise<void> {
  await assertPermission(PERMISSIONS.MANAGE_LMS);
  const parsed = blobUrl.safeParse(input?.url);
  if (!parsed.success) return;
  // only delete it if nothing points at it any more
  const [chapters, shorts, posters, docs] = await Promise.all([
    db.chapter.count({ where: { mediaUrl: parsed.data } }),
    db.shortVideo.count({ where: { videoUrl: parsed.data } }),
    db.shortVideo.count({ where: { posterUrl: parsed.data } }),
    db.learningDocument.count({ where: { fileUrl: parsed.data } }),
  ]);
  if (chapters + shorts + posters + docs === 0) await removeBlobs([parsed.data]);
}
