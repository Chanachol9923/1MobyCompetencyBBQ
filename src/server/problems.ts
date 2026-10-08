"use server";

/**
 * Problem reports: anyone signed in can send one; everyone holding
 * `manage_problems` sees them all, claims them (several people can), and marks
 * them fixed with a note and evidence. The reporter hears back through their
 * notifications at each step that matters to them.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { BLOB_URL, removeBlobs } from "@/server/blob";
import {
  assertPermission,
  assertViewer,
  NotAuthorised,
  recordActivity,
  type Viewer,
} from "@/server/session";
import {
  MAX_IMAGES,
  PROBLEM_CATEGORIES,
  type MyProblemRow,
  type ProblemPerson,
  type ProblemResult,
  type ProblemRow,
  type ProblemsAdminData,
} from "@/components/problems/types";

/* ---------------------------------------------------------------- plumbing */

const fail = (en: string, th: string): ProblemResult => ({ ok: false, error: { en, th } });
const done = (en: string, th: string, number?: number): ProblemResult => ({
  ok: true,
  message: { en, th },
  number,
});

function refresh() {
  revalidatePath("/admin/problems");
  revalidatePath("/problems");
  // the sidebar badge counts unclaimed reports
  revalidatePath("/", "layout");
}

async function guarded(
  run: (viewer: Viewer) => Promise<ProblemResult>,
  needsAdmin = true,
): Promise<ProblemResult> {
  try {
    const viewer = needsAdmin ? await assertPermission(PERMISSIONS.MANAGE_PROBLEMS) : await assertViewer();
    return await run(viewer);
  } catch (err) {
    if (err instanceof NotAuthorised) return fail(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้");
    throw err;
  }
}

const imageList = (folder: "screenshots" | "evidence") =>
  z
    .array(
      z
        .string()
        .max(600)
        .regex(BLOB_URL)
        .refine((u) => u.includes(`/reports/${folder}/`)),
    )
    .max(MAX_IMAGES)
    .default([]);

const PERSON = { id: true, name: true, email: true, employee: { select: { name: true } } } as const;
type PersonRow = { id: string; name: string | null; email: string; employee: { name: string } | null };
const person = (u: PersonRow): ProblemPerson => ({
  userId: u.id,
  name: u.employee?.name ?? u.name ?? u.email,
  email: u.email,
});

/** Everyone who handles reports right now. */
async function handlers() {
  return db.user.findMany({
    where: {
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: PERMISSIONS.MANAGE_PROBLEMS } } } },
    },
    select: { id: true },
  });
}

/* ================================================================ reporting */

const reportSchema = z.object({
  category: z.enum(PROBLEM_CATEGORIES as [string, ...string[]]),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(4000),
  pageUrl: z.string().trim().max(500).optional().default(""),
  userAgent: z.string().trim().max(400).optional().default(""),
  attachments: imageList("screenshots"),
});

export async function submitProblem(input: z.input<typeof reportSchema>): Promise<ProblemResult> {
  return guarded(async (viewer) => {
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      return field === "title"
        ? fail("Give the problem a short title (3 characters or more).", "กรุณาใส่หัวข้อสั้น ๆ อย่างน้อย 3 ตัวอักษร")
        : field === "description"
          ? fail("Describe what happened (5 characters or more).", "กรุณาอธิบายสิ่งที่เกิดขึ้นอย่างน้อย 5 ตัวอักษร")
          : fail("Some details could not be read. Please try again.", "อ่านข้อมูลบางส่วนไม่ได้ กรุณาลองใหม่");
    }
    const d = parsed.data;

    // a stuck key or a loop should not flood every admin's inbox
    const recent = await db.problemReport.count({
      where: { reporterId: viewer.userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= 10) {
      return fail(
        "You've sent 10 reports in the last hour. Please wait a little before sending another.",
        "คุณส่งรายงานครบ 10 เรื่องในชั่วโมงที่ผ่านมาแล้ว กรุณารอสักครู่ก่อนส่งเพิ่ม",
      );
    }

    // only the path, never a query string that might carry something private
    let pageUrl: string | null = null;
    try {
      pageUrl = d.pageUrl ? new URL(d.pageUrl, "http://x").pathname.slice(0, 200) : null;
    } catch {
      pageUrl = null;
    }

    const report = await db.problemReport.create({
      data: {
        reporterId: viewer.userId,
        category: d.category as ProblemRow["category"],
        title: d.title,
        description: d.description,
        pageUrl,
        userAgent: d.userAgent || null,
        attachments: d.attachments,
      },
      select: { id: true, number: true },
    });

    const admins = (await handlers()).filter((a) => a.id !== viewer.userId);
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: "PROBLEM" as const,
          titleEn: `New problem report #${report.number}`,
          titleTh: `มีการแจ้งปัญหาใหม่ #${report.number}`,
          bodyEn: `${viewer.name}: ${d.title}`,
          bodyTh: `${viewer.name}: ${d.title}`,
          href: `/admin/problems?id=${report.id}`,
        })),
      });
    }

    await recordActivity({
      viewer,
      action: "Reported a problem",
      targetType: "problem",
      targetId: report.id,
      targetLabel: `#${report.number} ${d.title}`,
      detail: d.category,
    });
    refresh();
    return done(
      `Report #${report.number} sent. The admin team has been notified.`,
      `ส่งรายงาน #${report.number} แล้ว ทีมผู้ดูแลระบบได้รับการแจ้งเตือนแล้ว`,
      report.number,
    );
  }, false);
}

const PROBLEM_SELECT = {
  id: true,
  number: true,
  category: true,
  title: true,
  description: true,
  pageUrl: true,
  userAgent: true,
  attachments: true,
  status: true,
  resolutionNote: true,
  resolutionImages: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reporter: { select: PERSON },
  resolvedBy: { select: PERSON },
  claims: { orderBy: { claimedAt: "asc" }, select: { claimedAt: true, user: { select: PERSON } } },
} as const;

type ProblemRecord = {
  id: string;
  number: number;
  category: ProblemRow["category"];
  title: string;
  description: string;
  pageUrl: string | null;
  userAgent: string | null;
  attachments: string[];
  status: ProblemRow["status"];
  resolutionNote: string | null;
  resolutionImages: string[];
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reporter: PersonRow;
  resolvedBy: PersonRow | null;
  claims: { claimedAt: Date; user: PersonRow }[];
};

const toRow = (r: ProblemRecord): ProblemRow => ({
  id: r.id,
  number: r.number,
  category: r.category,
  title: r.title,
  description: r.description,
  pageUrl: r.pageUrl,
  userAgent: r.userAgent,
  attachments: r.attachments,
  status: r.status,
  reporter: person(r.reporter),
  claims: r.claims.map((c) => ({ ...person(c.user), claimedAt: c.claimedAt.toISOString() })),
  resolutionNote: r.resolutionNote,
  resolutionImages: r.resolutionImages,
  resolvedBy: r.resolvedBy ? person(r.resolvedBy) : null,
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** The reports this person sent, newest first. */
export async function listMyProblems(): Promise<MyProblemRow[]> {
  const viewer = await assertViewer();
  const rows = await db.problemReport.findMany({
    where: { reporterId: viewer.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: PROBLEM_SELECT,
  });
  return rows.map((r) => {
    const { claims, reporter: _reporter, userAgent: _ua, ...rest } = toRow(r as ProblemRecord);
    return { ...rest, handlers: claims.map((c) => c.name) };
  });
}

/* ==================================================================== admin */

export async function getProblemsAdminData(): Promise<ProblemsAdminData> {
  const viewer = await assertPermission(PERMISSIONS.MANAGE_PROBLEMS);
  const [rows, grouped] = await Promise.all([
    db.problemReport.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 500,
      select: PROBLEM_SELECT,
    }),
    db.problemReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = { OPEN: 0, IN_PROGRESS: 0, FIXED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  return { problems: rows.map((r) => toRow(r as ProblemRecord)), counts, me: viewer.userId };
}

const idSchema = z.object({ id: z.string().min(1).max(64) });

async function findReport(id: string) {
  return db.problemReport.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      reporterId: true,
      resolutionImages: true,
      claims: { select: { userId: true } },
    },
  });
}

/** Take a report on. Others see the claim; several admins can share one. */
export async function claimProblem(input: z.input<typeof idSchema>): Promise<ProblemResult> {
  return guarded(async (viewer) => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown report.", "ไม่พบรายงานที่ระบุ");
    const report = await findReport(parsed.data.id);
    if (!report) return fail("That report no longer exists.", "ไม่พบรายงานนี้แล้ว");
    if (report.status === "FIXED") {
      return fail("This report is already fixed. Reopen it first.", "รายงานนี้แก้ไขแล้ว ต้องเปิดเรื่องใหม่ก่อน");
    }
    if (report.claims.some((c) => c.userId === viewer.userId)) {
      return done(`You're already on #${report.number}.`, `คุณรับเรื่อง #${report.number} อยู่แล้ว`);
    }

    const first = report.status === "OPEN";
    await db.$transaction([
      db.problemClaim.create({ data: { reportId: report.id, userId: viewer.userId } }),
      db.problemReport.update({ where: { id: report.id }, data: { status: "IN_PROGRESS" } }),
    ]);

    // the reporter hears once that someone has picked it up
    if (first && report.reporterId !== viewer.userId) {
      await db.notification.create({
        data: {
          userId: report.reporterId,
          kind: "PROBLEM",
          titleEn: `Your report #${report.number} is being looked at`,
          titleTh: `รายงาน #${report.number} ของคุณกำลังได้รับการดูแล`,
          bodyEn: `${viewer.name} has picked up “${report.title}”.`,
          bodyTh: `${viewer.name} รับเรื่อง “${report.title}” แล้ว`,
          href: `/problems?id=${report.id}`,
        },
      });
    }
    await recordActivity({
      viewer,
      action: "Claimed problem",
      targetType: "problem",
      targetId: report.id,
      targetLabel: `#${report.number} ${report.title}`,
    });
    refresh();
    return done(`You claimed #${report.number}.`, `คุณรับเรื่อง #${report.number} แล้ว`);
  });
}

/** Step back from a report. With nobody left on it, it is unclaimed again. */
export async function releaseProblem(input: z.input<typeof idSchema>): Promise<ProblemResult> {
  return guarded(async (viewer) => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown report.", "ไม่พบรายงานที่ระบุ");
    const report = await findReport(parsed.data.id);
    if (!report) return fail("That report no longer exists.", "ไม่พบรายงานนี้แล้ว");
    if (!report.claims.some((c) => c.userId === viewer.userId)) {
      return fail("You haven't claimed this report.", "คุณยังไม่ได้รับเรื่องนี้");
    }
    const left = report.claims.length - 1;
    await db.$transaction([
      db.problemClaim.delete({ where: { reportId_userId: { reportId: report.id, userId: viewer.userId } } }),
      ...(report.status === "IN_PROGRESS" && left === 0
        ? [db.problemReport.update({ where: { id: report.id }, data: { status: "OPEN" as const } })]
        : []),
    ]);
    await recordActivity({
      viewer,
      action: "Released problem",
      targetType: "problem",
      targetId: report.id,
      targetLabel: `#${report.number} ${report.title}`,
    });
    refresh();
    return done(
      left ? `You stepped back from #${report.number}.` : `#${report.number} is unclaimed again.`,
      left ? `คุณถอนตัวจากเรื่อง #${report.number} แล้ว` : `เรื่อง #${report.number} กลับเป็นยังไม่มีผู้รับเรื่อง`,
    );
  });
}

const resolveSchema = z.object({
  id: z.string().min(1).max(64),
  note: z.string().trim().min(3).max(4000),
  images: imageList("evidence"),
});

/** Close a report: what was done, with optional before/after evidence. */
export async function resolveProblem(input: z.input<typeof resolveSchema>): Promise<ProblemResult> {
  return guarded(async (viewer) => {
    const parsed = resolveSchema.safeParse(input);
    if (!parsed.success) {
      return parsed.error.issues[0]?.path[0] === "note"
        ? fail("Write what was fixed, so the reporter knows.", "กรุณาเขียนว่าแก้ไขอะไรไป เพื่อให้ผู้แจ้งทราบ")
        : fail("Some details could not be read.", "อ่านข้อมูลบางส่วนไม่ได้");
    }
    const report = await findReport(parsed.data.id);
    if (!report) return fail("That report no longer exists.", "ไม่พบรายงานนี้แล้ว");
    if (report.status === "FIXED") return fail("This report is already fixed.", "รายงานนี้แก้ไขแล้ว");

    const now = new Date();
    await db.$transaction([
      // whoever fixes it is on it, even if they never pressed Claim
      db.problemClaim.upsert({
        where: { reportId_userId: { reportId: report.id, userId: viewer.userId } },
        create: { reportId: report.id, userId: viewer.userId },
        update: {},
      }),
      db.problemReport.update({
        where: { id: report.id },
        data: {
          status: "FIXED",
          resolutionNote: parsed.data.note,
          resolutionImages: parsed.data.images,
          resolvedById: viewer.userId,
          resolvedAt: now,
        },
      }),
    ]);

    const others = report.claims.map((c) => c.userId).filter((id) => id !== viewer.userId);
    await db.notification.createMany({
      data: [
        ...(report.reporterId !== viewer.userId
          ? [
              {
                userId: report.reporterId,
                kind: "PROBLEM" as const,
                titleEn: `Fixed: your report #${report.number}`,
                titleTh: `แก้ไขแล้ว: รายงาน #${report.number} ของคุณ`,
                bodyEn: parsed.data.note.slice(0, 280),
                bodyTh: parsed.data.note.slice(0, 280),
                href: `/problems?id=${report.id}`,
              },
            ]
          : []),
        // the other admins on it should not keep working on a solved problem
        ...others.map((userId) => ({
          userId,
          kind: "PROBLEM" as const,
          titleEn: `#${report.number} was marked fixed`,
          titleTh: `เรื่อง #${report.number} ถูกแจ้งว่าแก้ไขแล้ว`,
          bodyEn: `${viewer.name} closed “${report.title}”.`,
          bodyTh: `${viewer.name} ปิดเรื่อง “${report.title}” แล้ว`,
          href: `/admin/problems?id=${report.id}`,
        })),
      ],
    });
    await recordActivity({
      viewer,
      action: "Resolved problem",
      targetType: "problem",
      targetId: report.id,
      targetLabel: `#${report.number} ${report.title}`,
      detail: parsed.data.images.length ? `${parsed.data.images.length} evidence image(s)` : undefined,
    });
    refresh();
    return done(
      `#${report.number} marked fixed. The reporter has been notified.`,
      `แจ้งว่าแก้ไขเรื่อง #${report.number} แล้ว ระบบแจ้งผู้รายงานให้แล้ว`,
    );
  });
}

/** It came back: open it again for whoever is still on it. */
export async function reopenProblem(input: z.input<typeof idSchema>): Promise<ProblemResult> {
  return guarded(async (viewer) => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown report.", "ไม่พบรายงานที่ระบุ");
    const report = await findReport(parsed.data.id);
    if (!report) return fail("That report no longer exists.", "ไม่พบรายงานนี้แล้ว");
    if (report.status !== "FIXED") return fail("This report is still open.", "รายงานนี้ยังเปิดอยู่");
    await db.problemReport.update({
      where: { id: report.id },
      data: {
        status: report.claims.length ? "IN_PROGRESS" : "OPEN",
        resolutionNote: null,
        resolutionImages: [],
        resolvedById: null,
        resolvedAt: null,
      },
    });
    await removeBlobs(report.resolutionImages);
    await recordActivity({
      viewer,
      action: "Reopened problem",
      targetType: "problem",
      targetId: report.id,
      targetLabel: `#${report.number} ${report.title}`,
    });
    refresh();
    return done(`#${report.number} is open again.`, `เปิดเรื่อง #${report.number} อีกครั้งแล้ว`);
  });
}

/** An image picked for a report or a fix, then taken off before sending. */
export async function discardReportImage(input: { url: string }): Promise<void> {
  await assertViewer();
  const url = typeof input?.url === "string" ? input.url : "";
  if (!BLOB_URL.test(url) || !/\/reports\/(screenshots|evidence)\//.test(url)) return;
  const used = await db.problemReport.count({
    where: { OR: [{ attachments: { has: url } }, { resolutionImages: { has: url } }] },
  });
  if (!used) await removeBlobs([url]);
}
