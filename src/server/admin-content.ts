"use server";

/**
 * Content administration: rewards, badges, the organisation chart, the course
 * library, the assessment cycle and the overview.
 *
 * Same contract as `src/server/admin-users.ts`. Every export is an async,
 * permission-guarded entry point; writes validate with zod, re-read every id
 * from the database before trusting it, record an activity row and revalidate.
 * Expected failures come back as typed bilingual values rather than throws, so
 * the screen can say *why* in the language the person is reading.
 *
 * Two things here are not ordinary CRUD:
 *
 *  - **Stock and points are money-like.** Adjusting stock, cancelling a
 *    redemption and granting a badge that carries points all go through a
 *    transaction and re-read the row inside it. The ledger is append-only: a
 *    revoked badge writes a compensating negative entry, it never deletes the
 *    original.
 *  - **`ExpectedLevel` decides who is assessed on what.** Setting a cell to null
 *    removes a competency from every holder of that career role, across the
 *    whole product. The action reports how many people it touched so the screen
 *    can show the consequence rather than a silent "saved".
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import {
  NotAuthorised,
  assertPermission,
  recordActivity,
  type Viewer,
} from "@/server/session";
import type { ActionResult, Bilingual } from "@/components/admin/admin-types";
import type {
  ActivityFeedRow,
  AdminBadgeRow,
  AdminCourseRow,
  AdminEmployeeRow,
  AdminOverviewData,
  AdminRewardRow,
  AssessmentAdminData,
  BadgeAdminData,
  BadgeHolder,
  CycleStatusRow,
  CycleSummary,
  DepartmentProgressRow,
  EmployeeAdminData,
  ExpectedLevelOutcome,
  ExpectedLevelResult,
  JobRoleRow,
  LmsAdminData,
  MatrixCompetency,
  OrgEntity,
  OrgUnitRow,
  OverviewEmployeeRow,
  RedemptionQueueRow,
  RewardAdminData,
} from "@/components/admin/content-types";

/* ------------------------------------------------------------------ plumbing */

const CONTENT_PATHS = [
  "/admin",
  "/admin/reward",
  "/admin/achievements",
  "/admin/employee",
  "/admin/employee/accounts",
  "/admin/lms",
  "/admin/assessment",
  "/reward",
  "/achievements",
];

function revalidateContent(...extra: string[]) {
  for (const p of [...CONTENT_PATHS, ...extra]) revalidatePath(p);
}

const msg = (en: string, th: string): Bilingual => ({ en, th });
const fail = (en: string, th: string): { ok: false; error: Bilingual } => ({
  ok: false,
  error: msg(en, th),
});
const done = (en: string, th: string): ActionResult => ({
  ok: true,
  message: msg(en, th),
});

/**
 * Guard + run. A permission failure comes back as a value so the screen can say
 * so in place; anything unexpected still throws to the error boundary.
 */
async function guarded(
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  run: (viewer: Viewer) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const viewer = await assertPermission(permission);
    return await run(viewer);
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return fail(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้");
    }
    throw err;
  }
}

const idSchema = z.string().min(1).max(64);
const shortText = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(160).optional().default("");
const longText = z.string().trim().max(4000).optional().default("");

/** A url-safe, unique-ish key derived from a name — `Reward.key` and friends. */
function slugify(value: string, fallback: string) {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || fallback;
}

/** Appends a counter until the key is free, so a rename never collides. */
async function uniqueKey(
  base: string,
  exists: (key: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ==========================================================================
   /admin/reward — catalogue, stock and the redemption queue
   ========================================================================== */

export async function getRewardAdminData(): Promise<RewardAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_REWARDS);

  const [rewards, byRewardStatus, queue, spentAgg] = await Promise.all([
    db.reward.findMany({
      orderBy: [{ active: "desc" }, { points: "asc" }],
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTh: true,
        points: true,
        stock: true,
        tone: true,
        image: true,
        active: true,
      },
    }),
    // one grouped query instead of a count per reward
    db.redemption.groupBy({ by: ["rewardId", "status"], _count: { _all: true } }),
    db.redemption.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        points: true,
        status: true,
        createdAt: true,
        rewardId: true,
        employeeId: true,
        employee: { select: { name: true, employeeCode: true } },
        reward: { select: { nameEn: true, nameTh: true } },
      },
    }),
    db.redemption.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { points: true },
    }),
  ]);

  const redeemed = new Map<string, number>();
  const preparing = new Map<string, number>();
  for (const g of byRewardStatus) {
    const n = g._count._all;
    if (g.status !== "CANCELLED") {
      redeemed.set(g.rewardId, (redeemed.get(g.rewardId) ?? 0) + n);
    }
    if (g.status === "PREPARING") preparing.set(g.rewardId, n);
  }

  const rows: AdminRewardRow[] = rewards.map((r) => ({
    ...r,
    redeemedCount: redeemed.get(r.id) ?? 0,
    preparingCount: preparing.get(r.id) ?? 0,
  }));

  const queueRows: RedemptionQueueRow[] = queue.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    employeeCode: r.employee.employeeCode,
    rewardId: r.rewardId,
    rewardNameEn: r.reward.nameEn,
    rewardNameTh: r.reward.nameTh,
    points: r.points,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    rewards: rows,
    queue: queueRows,
    counts: {
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      inStock: rows.filter((r) => r.active && r.stock > 0).length,
      redeemed: [...redeemed.values()].reduce((a, b) => a + b, 0),
      preparing: [...preparing.values()].reduce((a, b) => a + b, 0),
      pointsSpent: spentAgg._sum.points ?? 0,
    },
  };
}

const rewardFields = z.object({
  nameEn: shortText,
  nameTh: optionalText,
  points: z.coerce.number().int().min(0).max(1_000_000),
  stock: z.coerce.number().int().min(0).max(100_000),
  tone: z.string().trim().max(120).optional().default(""),
  image: z.string().trim().max(40).optional().default(""),
});

const createRewardSchema = rewardFields;
const updateRewardSchema = rewardFields.extend({ rewardId: idSchema });

const BAD_REWARD = fail(
  "Give the reward a name, a point price and a stock figure.",
  "กรุณากรอกชื่อของรางวัล คะแนนที่ใช้แลก และจำนวนคงเหลือ",
);

export async function createReward(
  input: z.input<typeof createRewardSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = createRewardSchema.safeParse(input);
    if (!parsed.success) return BAD_REWARD;
    const d = parsed.data;

    const key = await uniqueKey(slugify(d.nameEn, "reward"), async (k) =>
      Boolean(await db.reward.findUnique({ where: { key: k }, select: { id: true } })),
    );

    const reward = await db.reward.create({
      data: {
        key,
        nameEn: d.nameEn,
        nameTh: d.nameTh || null,
        points: d.points,
        stock: d.stock,
        tone: d.tone || null,
        image: d.image || null,
        active: true,
      },
      select: { id: true, nameEn: true, nameTh: true },
    });

    await recordActivity({
      viewer,
      action: "Created reward",
      targetType: "reward",
      targetId: reward.id,
      targetLabel: reward.nameEn,
      detail: `${d.points} points, stock ${d.stock}`,
    });
    revalidateContent();
    return done(
      `"${d.nameEn}" is in the catalogue — ${d.points} points, ${d.stock} in stock.`,
      `เพิ่ม "${d.nameTh || d.nameEn}" เข้ารายการแล้ว — ${d.points} คะแนน คงเหลือ ${d.stock} ชิ้น`,
    );
  });
}

export async function updateReward(
  input: z.input<typeof updateRewardSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = updateRewardSchema.safeParse(input);
    if (!parsed.success) return BAD_REWARD;
    const { rewardId, ...d } = parsed.data;

    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: { id: true, nameEn: true, points: true, stock: true },
    });
    if (!reward) {
      return fail("That reward no longer exists.", "ไม่พบของรางวัลนี้แล้ว");
    }

    await db.reward.update({
      where: { id: reward.id },
      data: {
        nameEn: d.nameEn,
        nameTh: d.nameTh || null,
        points: d.points,
        stock: d.stock,
        tone: d.tone || null,
        image: d.image || null,
      },
    });

    await recordActivity({
      viewer,
      action: "Edited reward",
      targetType: "reward",
      targetId: reward.id,
      targetLabel: d.nameEn,
      detail: `${reward.points} → ${d.points} points, stock ${reward.stock} → ${d.stock}`,
    });
    revalidateContent();
    return done(
      `"${d.nameEn}" updated — ${d.points} points, ${d.stock} in stock.`,
      `อัปเดต "${d.nameTh || d.nameEn}" แล้ว — ${d.points} คะแนน คงเหลือ ${d.stock} ชิ้น`,
    );
  });
}

const stockSchema = z.object({
  rewardId: idSchema,
  delta: z.coerce.number().int().min(-1000).max(1000),
});

/**
 * Nudge the stock up or down. The decrement is a conditional `updateMany` so it
 * can never push the column below zero, even if two administrators click at the
 * same instant — the same shape the employee-facing redemption uses.
 */
export async function adjustRewardStock(
  input: z.input<typeof stockSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = stockSchema.safeParse(input);
    if (!parsed.success || parsed.data.delta === 0) {
      return fail("Nothing to change.", "ไม่มีการเปลี่ยนแปลง");
    }
    const { rewardId, delta } = parsed.data;

    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: { id: true, nameEn: true, nameTh: true },
    });
    if (!reward) {
      return fail("That reward no longer exists.", "ไม่พบของรางวัลนี้แล้ว");
    }

    const changed = await db.reward.updateMany({
      where:
        delta < 0
          ? { id: reward.id, stock: { gte: -delta } }
          : { id: reward.id },
      data: { stock: { increment: delta } },
    });
    if (changed.count !== 1) {
      return fail(
        `"${reward.nameEn}" has nothing left to take out of stock.`,
        `"${reward.nameTh ?? reward.nameEn}" ไม่มีของเหลือให้ลดแล้ว`,
      );
    }

    const after = await db.reward.findUnique({
      where: { id: reward.id },
      select: { stock: true },
    });

    await recordActivity({
      viewer,
      action: "Adjusted reward stock",
      targetType: "reward",
      targetId: reward.id,
      targetLabel: reward.nameEn,
      detail: `${delta > 0 ? "+" : ""}${delta} → ${after?.stock ?? "?"}`,
    });
    revalidateContent();
    return done(
      `"${reward.nameEn}" stock is now ${after?.stock ?? 0}.`,
      `คงเหลือของ "${reward.nameTh ?? reward.nameEn}" เป็น ${after?.stock ?? 0} ชิ้น`,
    );
  });
}

const activeSchema = z.object({ rewardId: idSchema, active: z.boolean() });

export async function setRewardActive(
  input: z.input<typeof activeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = activeSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown reward.", "ไม่พบของรางวัลที่ระบุ");
    const { rewardId, active } = parsed.data;

    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: { id: true, nameEn: true, nameTh: true },
    });
    if (!reward) {
      return fail("That reward no longer exists.", "ไม่พบของรางวัลนี้แล้ว");
    }

    await db.reward.update({ where: { id: reward.id }, data: { active } });
    await recordActivity({
      viewer,
      action: active ? "Listed reward" : "Delisted reward",
      targetType: "reward",
      targetId: reward.id,
      targetLabel: reward.nameEn,
    });
    revalidateContent();
    return active
      ? done(
          `"${reward.nameEn}" is back in the catalogue.`,
          `นำ "${reward.nameTh ?? reward.nameEn}" กลับเข้ารายการแล้ว`,
        )
      : done(
          `"${reward.nameEn}" is hidden from the catalogue. Past redemptions are untouched.`,
          `ซ่อน "${reward.nameTh ?? reward.nameEn}" จากรายการแล้ว ประวัติการแลกที่ผ่านมายังคงอยู่`,
        );
  });
}

const deleteRewardSchema = z.object({ rewardId: idSchema });

/**
 * Deleting is only allowed while nothing points at the row. A reward somebody
 * has redeemed is part of their history, so the answer there is to delist it.
 */
export async function deleteReward(
  input: z.input<typeof deleteRewardSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = deleteRewardSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown reward.", "ไม่พบของรางวัลที่ระบุ");

    const reward = await db.reward.findUnique({
      where: { id: parsed.data.rewardId },
      select: {
        id: true,
        nameEn: true,
        nameTh: true,
        _count: { select: { redemptions: true } },
      },
    });
    if (!reward) {
      return fail("That reward no longer exists.", "ไม่พบของรางวัลนี้แล้ว");
    }
    if (reward._count.redemptions > 0) {
      return fail(
        `${reward._count.redemptions} redemption(s) refer to "${reward.nameEn}". Delist it instead — deleting it would erase people's history.`,
        `มีประวัติการแลก ${reward._count.redemptions} รายการที่อ้างถึง "${reward.nameTh ?? reward.nameEn}" กรุณาใช้การซ่อนจากรายการแทน เพราะการลบจะทำให้ประวัติของพนักงานหายไป`,
      );
    }

    await db.reward.delete({ where: { id: reward.id } });
    await recordActivity({
      viewer,
      action: "Deleted reward",
      targetType: "reward",
      targetId: reward.id,
      targetLabel: reward.nameEn,
    });
    revalidateContent();
    return done(
      `"${reward.nameEn}" deleted.`,
      `ลบ "${reward.nameTh ?? reward.nameEn}" แล้ว`,
    );
  });
}

const redemptionStatusSchema = z.object({
  redemptionId: idSchema,
  status: z.enum(["DELIVERED", "CANCELLED"]),
});

/**
 * Move a redemption along.
 *
 * "Delivered" is a status change. "Cancelled" is a refund: the points go back on
 * the ledger as a fresh positive entry and the item goes back into stock, both
 * inside one transaction, and only from PREPARING — you cannot un-hand-over
 * something that has already been handed over.
 */
export async function setRedemptionStatus(
  input: z.input<typeof redemptionStatusSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = redemptionStatusSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown request.", "ไม่พบคำขอที่ระบุ");
    const { redemptionId, status } = parsed.data;

    const redemption = await db.redemption.findUnique({
      where: { id: redemptionId },
      select: {
        id: true,
        status: true,
        points: true,
        employeeId: true,
        rewardId: true,
        employee: { select: { name: true } },
        reward: { select: { nameEn: true, nameTh: true } },
      },
    });
    if (!redemption) {
      return fail("That request no longer exists.", "ไม่พบคำขอนี้แล้ว");
    }
    if (redemption.status !== "PREPARING") {
      return fail(
        `That request is already ${redemption.status.toLowerCase()}.`,
        "คำขอนี้ถูกดำเนินการไปแล้ว",
      );
    }

    if (status === "DELIVERED") {
      await db.redemption.update({
        where: { id: redemption.id },
        data: { status: "DELIVERED" },
      });
      await recordActivity({
        viewer,
        action: "Marked redemption delivered",
        targetType: "redemption",
        targetId: redemption.id,
        targetLabel: redemption.reward.nameEn,
        detail: `${redemption.employee.name}, ${redemption.points} points`,
      });
      revalidateContent();
      return done(
        `"${redemption.reward.nameEn}" marked delivered to ${redemption.employee.name}.`,
        `บันทึกว่าส่งมอบ "${redemption.reward.nameTh ?? redemption.reward.nameEn}" ให้ ${redemption.employee.name} แล้ว`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.redemption.update({
        where: { id: redemption.id },
        data: { status: "CANCELLED" },
      });
      await tx.reward.update({
        where: { id: redemption.rewardId },
        data: { stock: { increment: 1 } },
      });
      // the ledger is append-only: the refund is a new row, never an edit
      await tx.pointLedger.create({
        data: {
          employeeId: redemption.employeeId,
          delta: redemption.points,
          reason: `Refund — ${redemption.reward.nameEn}`,
          refType: "redemption",
          refId: redemption.id,
        },
      });
    });

    await recordActivity({
      viewer,
      action: "Cancelled redemption",
      targetType: "redemption",
      targetId: redemption.id,
      targetLabel: redemption.reward.nameEn,
      detail: `${redemption.employee.name} refunded ${redemption.points} points`,
    });
    revalidateContent();
    return done(
      `Cancelled — ${redemption.employee.name} got ${redemption.points} points back and the item returned to stock.`,
      `ยกเลิกแล้ว — คืน ${redemption.points} คะแนนให้ ${redemption.employee.name} และนำของกลับเข้าสต๊อก`,
    );
  });
}

/* ==========================================================================
   /admin/achievements — badges and who holds them
   ========================================================================== */

export async function getBadgeAdminData(): Promise<BadgeAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_REWARDS);

  const [badges, held, employees] = await Promise.all([
    db.badge.findMany({
      orderBy: [{ active: "desc" }, { nameEn: "asc" }],
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTh: true,
        requirementEn: true,
        requirementTh: true,
        points: true,
        tone: true,
        source: true,
        target: true,
        active: true,
      },
    }),
    // every holder of every badge in one query, grouped in memory afterwards
    db.employeeBadge.findMany({
      orderBy: { earnedAt: "desc" },
      select: {
        badgeId: true,
        earnedAt: true,
        employee: { select: { id: true, name: true, employeeCode: true } },
      },
    }),
    db.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    }),
  ]);

  const holdersByBadge = new Map<string, BadgeHolder[]>();
  for (const h of held) {
    const list = holdersByBadge.get(h.badgeId) ?? [];
    list.push({
      employeeId: h.employee.id,
      name: h.employee.name,
      employeeCode: h.employee.employeeCode,
      earnedAt: h.earnedAt.toISOString(),
    });
    holdersByBadge.set(h.badgeId, list);
  }

  const rows: AdminBadgeRow[] = badges.map((b) => {
    const holders = holdersByBadge.get(b.id) ?? [];
    return { ...b, holders, holderCount: holders.length };
  });

  return {
    badges: rows,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      departmentName: e.department?.name ?? null,
    })),
    counts: {
      total: rows.length,
      active: rows.filter((b) => b.active).length,
      awarded: held.length,
    },
  };
}

const BADGE_SOURCES = ["manual", "courses", "certificates", "assessments", "paths"] as const;

const badgeFields = z.object({
  nameEn: shortText,
  nameTh: optionalText,
  requirementEn: z.string().trim().max(200).optional().default(""),
  requirementTh: z.string().trim().max(200).optional().default(""),
  points: z.coerce.number().int().min(0).max(100_000),
  tone: z.string().trim().max(120).optional().default(""),
  source: z.enum(BADGE_SOURCES),
  /** ignored for a manual badge — there is no counter to compare it against */
  target: z.coerce.number().int().min(1).max(1000).optional(),
});

const createBadgeSchema = badgeFields;
const updateBadgeSchema = badgeFields.extend({ badgeId: idSchema });

const BAD_BADGE = fail(
  "Give the badge a name and say what earns it.",
  "กรุณากรอกชื่อเหรียญตราและเงื่อนไขการได้รับ",
);

/** A counter-driven badge needs a target; a manual one must not carry one. */
function targetFor(source: string, target: number | undefined) {
  return source === "manual" ? null : (target ?? 1);
}

export async function createBadge(
  input: z.input<typeof createBadgeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = createBadgeSchema.safeParse(input);
    if (!parsed.success) return BAD_BADGE;
    const d = parsed.data;

    const key = await uniqueKey(slugify(d.nameEn, "badge"), async (k) =>
      Boolean(await db.badge.findUnique({ where: { key: k }, select: { id: true } })),
    );

    const badge = await db.badge.create({
      data: {
        key,
        nameEn: d.nameEn,
        nameTh: d.nameTh || null,
        requirementEn: d.requirementEn || null,
        requirementTh: d.requirementTh || null,
        points: d.points,
        tone: d.tone || null,
        source: d.source,
        target: targetFor(d.source, d.target),
        active: true,
      },
      select: { id: true, nameEn: true },
    });

    await recordActivity({
      viewer,
      action: "Created badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: badge.nameEn,
      detail: `source: ${d.source}${d.source === "manual" ? "" : ` × ${targetFor(d.source, d.target)}`}`,
    });
    revalidateContent();
    return done(
      d.source === "manual"
        ? `"${d.nameEn}" created. Grant it to people from the holders list.`
        : `"${d.nameEn}" created — it unlocks itself at ${targetFor(d.source, d.target)} ${d.source}.`,
      d.source === "manual"
        ? `สร้างเหรียญตรา "${d.nameTh || d.nameEn}" แล้ว มอบให้พนักงานได้จากรายชื่อผู้ถือครอง`
        : `สร้างเหรียญตรา "${d.nameTh || d.nameEn}" แล้ว จะปลดล็อกอัตโนมัติเมื่อถึง ${targetFor(d.source, d.target)} รายการ`,
    );
  });
}

export async function updateBadge(
  input: z.input<typeof updateBadgeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = updateBadgeSchema.safeParse(input);
    if (!parsed.success) return BAD_BADGE;
    const { badgeId, ...d } = parsed.data;

    const badge = await db.badge.findUnique({
      where: { id: badgeId },
      select: { id: true, nameEn: true, source: true, target: true },
    });
    if (!badge) return fail("That badge no longer exists.", "ไม่พบเหรียญตรานี้แล้ว");

    await db.badge.update({
      where: { id: badge.id },
      data: {
        nameEn: d.nameEn,
        nameTh: d.nameTh || null,
        requirementEn: d.requirementEn || null,
        requirementTh: d.requirementTh || null,
        points: d.points,
        tone: d.tone || null,
        source: d.source,
        target: targetFor(d.source, d.target),
      },
    });

    await recordActivity({
      viewer,
      action: "Edited badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: d.nameEn,
      detail: `${badge.source}/${badge.target ?? "—"} → ${d.source}/${targetFor(d.source, d.target) ?? "—"}`,
    });
    revalidateContent();
    return done(
      `"${d.nameEn}" updated.`,
      `อัปเดตเหรียญตรา "${d.nameTh || d.nameEn}" แล้ว`,
    );
  });
}

const badgeActiveSchema = z.object({ badgeId: idSchema, active: z.boolean() });

export async function setBadgeActive(
  input: z.input<typeof badgeActiveSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = badgeActiveSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown badge.", "ไม่พบเหรียญตราที่ระบุ");
    const { badgeId, active } = parsed.data;

    const badge = await db.badge.findUnique({
      where: { id: badgeId },
      select: { id: true, nameEn: true, nameTh: true },
    });
    if (!badge) return fail("That badge no longer exists.", "ไม่พบเหรียญตรานี้แล้ว");

    await db.badge.update({ where: { id: badge.id }, data: { active } });
    await recordActivity({
      viewer,
      action: active ? "Activated badge" : "Deactivated badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: badge.nameEn,
    });
    revalidateContent();
    return done(
      active
        ? `"${badge.nameEn}" is showing in the collection again.`
        : `"${badge.nameEn}" is hidden. People who already hold it keep it.`,
      active
        ? `แสดง "${badge.nameTh ?? badge.nameEn}" ในคลังเหรียญตราอีกครั้ง`
        : `ซ่อน "${badge.nameTh ?? badge.nameEn}" แล้ว ผู้ที่ได้รับไปแล้วยังคงถือครองอยู่`,
    );
  });
}

const deleteBadgeSchema = z.object({ badgeId: idSchema });

export async function deleteBadge(
  input: z.input<typeof deleteBadgeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = deleteBadgeSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown badge.", "ไม่พบเหรียญตราที่ระบุ");

    const badge = await db.badge.findUnique({
      where: { id: parsed.data.badgeId },
      select: {
        id: true,
        nameEn: true,
        nameTh: true,
        _count: { select: { holders: true } },
      },
    });
    if (!badge) return fail("That badge no longer exists.", "ไม่พบเหรียญตรานี้แล้ว");
    if (badge._count.holders > 0) {
      return fail(
        `${badge._count.holders} people hold "${badge.nameEn}". Deactivate it instead so they keep what they earned.`,
        `มีพนักงาน ${badge._count.holders} คนถือครอง "${badge.nameTh ?? badge.nameEn}" กรุณาปิดใช้งานแทนการลบ เพื่อให้พวกเขายังคงเหรียญที่ได้รับไว้`,
      );
    }

    await db.badge.delete({ where: { id: badge.id } });
    await recordActivity({
      viewer,
      action: "Deleted badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: badge.nameEn,
    });
    revalidateContent();
    return done(
      `"${badge.nameEn}" deleted.`,
      `ลบเหรียญตรา "${badge.nameTh ?? badge.nameEn}" แล้ว`,
    );
  });
}

const grantSchema = z.object({ badgeId: idSchema, employeeId: idSchema });

/**
 * Award a badge by hand. If it carries points, the award and the ledger entry
 * are written together — a badge that says "+150" and does not move the balance
 * would be a lie on two screens at once.
 */
export async function grantBadge(
  input: z.input<typeof grantSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = grantSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Pick a badge and a person.", "กรุณาเลือกเหรียญตราและพนักงาน");
    }
    const { badgeId, employeeId } = parsed.data;

    const [badge, employee] = await Promise.all([
      db.badge.findUnique({
        where: { id: badgeId },
        select: { id: true, nameEn: true, nameTh: true, points: true },
      }),
      db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true },
      }),
    ]);
    if (!badge) return fail("That badge no longer exists.", "ไม่พบเหรียญตรานี้แล้ว");
    if (!employee) return fail("That employee no longer exists.", "ไม่พบพนักงานคนนี้แล้ว");

    const already = await db.employeeBadge.findUnique({
      where: { employeeId_badgeId: { employeeId: employee.id, badgeId: badge.id } },
      select: { earnedAt: true },
    });
    if (already) {
      return fail(
        `${employee.name} already holds "${badge.nameEn}".`,
        `${employee.name} ถือครอง "${badge.nameTh ?? badge.nameEn}" อยู่แล้ว`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.employeeBadge.create({
        data: { employeeId: employee.id, badgeId: badge.id },
      });
      if (badge.points > 0) {
        await tx.pointLedger.create({
          data: {
            employeeId: employee.id,
            delta: badge.points,
            reason: `Badge — ${badge.nameEn}`,
            refType: "badge",
            refId: badge.id,
          },
        });
      }
    });

    await recordActivity({
      viewer,
      action: "Granted badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: badge.nameEn,
      detail: `${employee.name}${badge.points > 0 ? ` (+${badge.points} points)` : ""}`,
    });
    revalidateContent();
    return done(
      badge.points > 0
        ? `${employee.name} earned "${badge.nameEn}" and ${badge.points} points.`
        : `${employee.name} earned "${badge.nameEn}".`,
      badge.points > 0
        ? `${employee.name} ได้รับ "${badge.nameTh ?? badge.nameEn}" และ ${badge.points} คะแนนแล้ว`
        : `${employee.name} ได้รับ "${badge.nameTh ?? badge.nameEn}" แล้ว`,
    );
  });
}

export async function revokeBadge(
  input: z.input<typeof grantSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_REWARDS, async (viewer) => {
    const parsed = grantSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Pick a badge and a person.", "กรุณาเลือกเหรียญตราและพนักงาน");
    }
    const { badgeId, employeeId } = parsed.data;

    const [badge, employee, held] = await Promise.all([
      db.badge.findUnique({
        where: { id: badgeId },
        select: { id: true, nameEn: true, nameTh: true, points: true },
      }),
      db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true },
      }),
      db.employeeBadge.findUnique({
        where: { employeeId_badgeId: { employeeId, badgeId } },
        select: { earnedAt: true },
      }),
    ]);
    if (!badge) return fail("That badge no longer exists.", "ไม่พบเหรียญตรานี้แล้ว");
    if (!employee) return fail("That employee no longer exists.", "ไม่พบพนักงานคนนี้แล้ว");
    if (!held) {
      return fail(
        `${employee.name} does not hold "${badge.nameEn}".`,
        `${employee.name} ไม่ได้ถือครอง "${badge.nameTh ?? badge.nameEn}"`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.employeeBadge.delete({
        where: { employeeId_badgeId: { employeeId: employee.id, badgeId: badge.id } },
      });
      if (badge.points > 0) {
        // a compensating entry, because the ledger is never rewritten
        await tx.pointLedger.create({
          data: {
            employeeId: employee.id,
            delta: -badge.points,
            reason: `Badge withdrawn — ${badge.nameEn}`,
            refType: "badge",
            refId: badge.id,
          },
        });
      }
    });

    await recordActivity({
      viewer,
      action: "Revoked badge",
      targetType: "badge",
      targetId: badge.id,
      targetLabel: badge.nameEn,
      detail: `${employee.name}${badge.points > 0 ? ` (-${badge.points} points)` : ""}`,
    });
    revalidateContent();
    return done(
      badge.points > 0
        ? `"${badge.nameEn}" withdrawn from ${employee.name}, and ${badge.points} points with it.`
        : `"${badge.nameEn}" withdrawn from ${employee.name}.`,
      badge.points > 0
        ? `ถอน "${badge.nameTh ?? badge.nameEn}" จาก ${employee.name} พร้อมหัก ${badge.points} คะแนนแล้ว`
        : `ถอน "${badge.nameTh ?? badge.nameEn}" จาก ${employee.name} แล้ว`,
    );
  });
}

/* ==========================================================================
   workforce arithmetic — shared by the overview and the cycle screen
   ========================================================================== */

/**
 * Everything those screens need about the workforce, in a fixed number of
 * queries.
 *
 * The naive version asks "what is this person's skill index?" once per
 * employee, which is twenty-two round trips on a twenty-two person company and
 * a thousand on a thousand-person one. Instead: one query for the people, one
 * for the whole expected-level matrix, one for the cycle's assessments and one
 * for the points — and the arithmetic happens here.
 */
async function loadWorkforce(cycleId: string | null) {
  const [employees, expected, assessments, points] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        nickname: true,
        email: true,
        grade: true,
        businessUnit: true,
        remark: true,
        jobRoleId: true,
        managerId: true,
        jobRole: { select: { name: true, level: true } },
        department: { select: { id: true, name: true } },
        division: { select: { name: true } },
        position: { select: { name: true } },
      },
    }),
    db.expectedLevel.findMany({
      where: { level: { not: null } },
      select: { jobRoleId: true, competencyId: true },
    }),
    cycleId
      ? db.assessment.findMany({
          where: { cycleId },
          select: {
            subjectId: true,
            mode: true,
            submittedAt: true,
            scores: { select: { competencyId: true, score: true } },
          },
        })
      : Promise.resolve([]),
    db.pointLedger.groupBy({ by: ["employeeId"], _sum: { delta: true } }),
  ]);

  // jobRoleId -> the competencies that career role is assessed on at all
  const assessedByRole = new Map<string, Set<string>>();
  for (const e of expected) {
    const set = assessedByRole.get(e.jobRoleId) ?? new Set<string>();
    set.add(e.competencyId);
    assessedByRole.set(e.jobRoleId, set);
  }

  type Scores = { self: Map<string, number>; manager: Map<string, number> };
  const scoresBySubject = new Map<string, Scores>();
  const selfSubmitted = new Set<string>();
  const supervisorSubmitted = new Set<string>();
  for (const a of assessments) {
    const entry = scoresBySubject.get(a.subjectId) ?? {
      self: new Map<string, number>(),
      manager: new Map<string, number>(),
    };
    const target = a.mode === "SELF" ? entry.self : entry.manager;
    for (const s of a.scores) target.set(s.competencyId, s.score);
    scoresBySubject.set(a.subjectId, entry);
    if (a.submittedAt) {
      (a.mode === "SELF" ? selfSubmitted : supervisorSubmitted).add(a.subjectId);
    }
  }

  const pointsById = new Map(points.map((p) => [p.employeeId, p._sum.delta ?? 0]));
  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  const rows = employees.map((e) => {
    const assessed = assessedByRole.get(e.jobRoleId) ?? new Set<string>();
    const scores = scoresBySubject.get(e.id);
    const values: number[] = [];
    for (const competencyId of assessed) {
      // the supervisor's score is the one that counts; the self score stands in
      // only until the review happens — the same rule as the gap engine
      const score =
        scores?.manager.get(competencyId) ?? scores?.self.get(competencyId) ?? null;
      if (score !== null) values.push(score);
    }
    const skillIndex = values.length
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
      : 0;

    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      nickname: e.nickname,
      email: e.email,
      jobRoleId: e.jobRoleId,
      jobRoleName: e.jobRole.name,
      level: e.jobRole.level,
      positionName: e.position?.name ?? null,
      departmentName: e.department?.name ?? null,
      divisionName: e.division?.name ?? null,
      businessUnit: e.businessUnit,
      grade: e.grade,
      remark: e.remark,
      managerName: e.managerId ? (nameById.get(e.managerId) ?? null) : null,
      skillIndex,
      phase: assessed.size ? Math.round((values.length / assessed.size) * 100) : 0,
      assessedCount: assessed.size,
      points: pointsById.get(e.id) ?? 0,
      selfSubmitted: selfSubmitted.has(e.id),
      supervisorSubmitted: supervisorSubmitted.has(e.id),
    };
  });

  return {
    rows,
    selfSubmittedCount: rows.filter((r) => r.selfSubmitted).length,
    supervisorSubmittedCount: rows.filter((r) => r.supervisorSubmitted).length,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toCycleSummary(cycle: {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  startsAt: Date;
  endsAt: Date;
  status: "DRAFT" | "OPEN" | "REVIEW" | "CLOSED";
  weightKpi: number;
  weightCore: number;
  weightFunctional: number;
  weightManagerial: number;
}): CycleSummary {
  return {
    id: cycle.id,
    key: cycle.key,
    nameEn: cycle.nameEn,
    nameTh: cycle.nameTh,
    startsAt: cycle.startsAt.toISOString().slice(0, 10),
    endsAt: cycle.endsAt.toISOString().slice(0, 10),
    status: cycle.status,
    weightKpi: cycle.weightKpi,
    weightCore: cycle.weightCore,
    weightFunctional: cycle.weightFunctional,
    weightManagerial: cycle.weightManagerial,
    daysRemaining: Math.max(
      0,
      Math.ceil((cycle.endsAt.getTime() - Date.now()) / DAY_MS),
    ),
  };
}

/** The open cycle, or the most recent one when nothing is open. */
async function currentCycleRow() {
  return (
    (await db.assessmentCycle.findFirst({
      where: { status: "OPEN" },
      orderBy: { startsAt: "desc" },
    })) ?? (await db.assessmentCycle.findFirst({ orderBy: { startsAt: "desc" } }))
  );
}

/* ==========================================================================
   /admin — the overview
   ========================================================================== */

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  await assertPermission(PERMISSIONS.MANAGE_USERS);

  const cycle = await currentCycleRow();
  const [workforce, certificates, activity] = await Promise.all([
    loadWorkforce(cycle?.id ?? null),
    db.certificate.count(),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        actorLabel: true,
        action: true,
        targetLabel: true,
        createdAt: true,
      },
    }),
  ]);

  // the department rollup is folded from the rows we already have, not requeried
  const byDepartment = new Map<string, OverviewEmployeeRow[]>();
  for (const row of workforce.rows) {
    const key = row.departmentName ?? "—";
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), row]);
  }

  const departments: DepartmentProgressRow[] = [...byDepartment.entries()]
    .map(([name, members]) => {
      const progress = Math.round(
        members.reduce((a, m) => a + m.phase, 0) / Math.max(members.length, 1),
      );
      return {
        id: name,
        name,
        headcount: members.length,
        assessed: members.filter((m) => m.phase >= 100).length,
        progress,
        status:
          progress >= 100
            ? ("complete" as const)
            : progress >= 60
              ? ("on-track" as const)
              : ("follow-up" as const),
      };
    })
    .sort((a, b) => b.headcount - a.headcount);

  const feed: ActivityFeedRow[] = activity.map((a) => ({
    id: a.id,
    actorLabel: a.actorLabel,
    action: a.action,
    targetLabel: a.targetLabel,
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    cycle: cycle ? toCycleSummary(cycle) : null,
    counts: {
      headcount: workforce.rows.length,
      selfSubmitted: workforce.selfSubmittedCount,
      supervisorSubmitted: workforce.supervisorSubmittedCount,
      certificates,
    },
    departments,
    employees: workforce.rows,
    activity: feed,
  };
}

function csvCell(value: string | number | null | undefined) {
  const s = String(value ?? "");
  return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The organisation-wide skills export.
 *
 * Built on the server from the same derivation the table shows, behind its own
 * permission: reading the dashboard and being allowed to walk out with the whole
 * staff list are two different things, and `export_employee_list` decides the
 * second one.
 */
export async function exportOrgSkillsCsv(): Promise<
  { ok: true; csv: string; rows: number } | { ok: false; error: Bilingual }
> {
  let viewer: Viewer;
  try {
    viewer = await assertPermission(PERMISSIONS.EXPORT_EMPLOYEE_LIST);
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return fail(err.message, "คุณไม่มีสิทธิ์ส่งออกรายชื่อพนักงาน");
    }
    throw err;
  }

  const cycle = await currentCycleRow();
  const { rows } = await loadWorkforce(cycle?.id ?? null);

  const header = [
    "employee_id",
    "name",
    "nickname",
    "email",
    "career_role",
    "level",
    "position",
    "grade",
    "business_unit",
    "department",
    "division",
    "report_to",
    "skill_index",
    "assessment_phase_pct",
    "competencies_assessed",
    "points",
    "self_submitted",
    "supervisor_submitted",
  ];
  const body = rows.map((r) =>
    [
      r.employeeCode,
      r.name,
      r.nickname,
      r.email,
      r.jobRoleName,
      r.level,
      r.positionName,
      r.grade,
      r.businessUnit,
      r.departmentName,
      r.divisionName,
      r.managerName,
      r.skillIndex,
      r.phase,
      r.assessedCount,
      r.points,
      r.selfSubmitted ? "yes" : "no",
      r.supervisorSubmitted ? "yes" : "no",
    ]
      .map(csvCell)
      .join(","),
  );

  await recordActivity({
    viewer,
    action: "Exported org skills report",
    targetType: "report",
    targetLabel: cycle?.nameEn ?? "No cycle",
    detail: `${rows.length} employees`,
  });

  return { ok: true, csv: [header.join(","), ...body].join("\r\n"), rows: rows.length };
}

const remindSchema = z.object({ employeeId: idSchema });

/**
 * Nudge one person about the open cycle.
 *
 * `manage_cycle` is the permission whose own description covers "cycle dates,
 * reminders and completion tracking", so it is the one that gates this — not the
 * broader announcements permission, which is about publishing to the company.
 */
export async function remindEmployee(
  input: z.input<typeof remindSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_CYCLE, async (viewer) => {
    const parsed = remindSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown employee.", "ไม่พบพนักงานที่ระบุ");

    const employee = await db.employee.findUnique({
      where: { id: parsed.data.employeeId },
      select: { id: true, name: true, active: true },
    });
    if (!employee) return fail("That employee no longer exists.", "ไม่พบพนักงานคนนี้แล้ว");
    if (!employee.active) {
      return fail(
        `${employee.name} is deactivated and will not see a reminder.`,
        `${employee.name} ถูกปิดใช้งานอยู่ จะไม่ได้รับการแจ้งเตือน`,
      );
    }

    const cycle = await currentCycleRow();
    const due = cycle ? cycle.endsAt.toISOString().slice(0, 10) : null;
    await db.notification.create({
      data: {
        employeeId: employee.id,
        kind: "ASSESSMENT",
        channel: "IN_APP",
        titleEn: "Assessment reminder",
        titleTh: "แจ้งเตือนการประเมิน",
        bodyEn: cycle
          ? `Your self assessment for ${cycle.nameEn} closes on ${due}.`
          : "Your self assessment is still open — please finish it.",
        bodyTh: cycle
          ? `การประเมินตนเองรอบ ${cycle.nameTh} จะปิดวันที่ ${due}`
          : "การประเมินตนเองของคุณยังไม่เสร็จ กรุณาดำเนินการให้เรียบร้อย",
        href: "/assessment",
      },
    });

    await recordActivity({
      viewer,
      action: "Sent assessment reminder",
      targetType: "employee",
      targetId: employee.id,
      targetLabel: employee.name,
      detail: cycle?.nameEn ?? "No open cycle",
    });
    revalidateContent("/announcements");
    return done(
      `Reminder sent to ${employee.name}.`,
      `ส่งการแจ้งเตือนถึง ${employee.name} แล้ว`,
    );
  });
}

const remindAllSchema = z.object({ mode: z.enum(["SELF", "SUPERVISOR"]) });

/** The same nudge to everyone still outstanding — one insert, not one per row. */
export async function remindEveryonePending(
  input: z.input<typeof remindAllSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_CYCLE, async (viewer) => {
    const parsed = remindAllSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown reminder.", "ไม่พบรูปแบบการแจ้งเตือน");

    const cycle = await currentCycleRow();
    if (!cycle) {
      return fail(
        "There is no assessment cycle to remind anyone about.",
        "ยังไม่มีรอบการประเมินที่จะแจ้งเตือน",
      );
    }

    const { rows } = await loadWorkforce(cycle.id);
    const pending = rows.filter((r) =>
      parsed.data.mode === "SELF" ? !r.selfSubmitted : !r.supervisorSubmitted,
    );
    if (pending.length === 0) {
      return done(
        "Everybody has submitted — nobody to remind.",
        "ทุกคนส่งเรียบร้อยแล้ว ไม่มีใครต้องแจ้งเตือน",
      );
    }

    const due = cycle.endsAt.toISOString().slice(0, 10);
    await db.notification.createMany({
      data: pending.map((p) => ({
        employeeId: p.id,
        kind: "ASSESSMENT" as const,
        channel: "IN_APP" as const,
        titleEn: "Assessment reminder",
        titleTh: "แจ้งเตือนการประเมิน",
        bodyEn: `${cycle.nameEn} is still open for you. It closes on ${due}.`,
        bodyTh: `รอบ ${cycle.nameTh} ของคุณยังไม่เสร็จ จะปิดวันที่ ${due}`,
        href: "/assessment",
      })),
    });

    await recordActivity({
      viewer,
      action: "Sent bulk assessment reminder",
      targetType: "cycle",
      targetId: cycle.id,
      targetLabel: cycle.nameEn,
      detail: `${pending.length} people, ${parsed.data.mode.toLowerCase()}`,
    });
    revalidateContent("/announcements");
    return done(
      `Reminder sent to ${pending.length} ${pending.length === 1 ? "person" : "people"}.`,
      `ส่งการแจ้งเตือนถึงพนักงาน ${pending.length} คนแล้ว`,
    );
  });
}

/* ==========================================================================
   /admin/employee — the staff data set and the organisation chart
   ========================================================================== */

export async function getEmployeeAdminData(): Promise<EmployeeAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_USERS);

  const [employees, departments, divisions, positions, jobRoles, expectedCounts] =
    await Promise.all([
      db.employee.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: {
          id: true,
          employeeCode: true,
          name: true,
          nickname: true,
          email: true,
          grade: true,
          businessUnit: true,
          remark: true,
          active: true,
          userId: true,
          managerId: true,
          jobRoleId: true,
          jobRole: { select: { name: true, level: true } },
          department: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
          _count: { select: { reports: true } },
        },
      }),
      db.department.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: true, divisions: true } },
        },
      }),
      db.division.findMany({
        orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { name: true } },
          _count: { select: { employees: true } },
        },
      }),
      db.position.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { name: true } },
          _count: { select: { employees: true } },
        },
      }),
      db.jobRole.findMany({
        orderBy: [{ sortOrder: "asc" }, { levelRank: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
          level: true,
          levelRank: true,
          gradeFrom: true,
          gradeTo: true,
          _count: { select: { employees: true } },
        },
      }),
      // one grouped query for the whole matrix rather than one per career role
      db.expectedLevel.groupBy({
        by: ["jobRoleId"],
        where: { level: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const nameById = new Map(employees.map((e) => [e.id, e.name]));
  const assessedByRole = new Map(
    expectedCounts.map((g) => [g.jobRoleId, g._count._all]),
  );

  const rows: AdminEmployeeRow[] = employees.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    nickname: e.nickname,
    email: e.email,
    grade: e.grade,
    businessUnit: e.businessUnit,
    remark: e.remark,
    active: e.active,
    jobRoleId: e.jobRoleId,
    jobRoleName: e.jobRole.name,
    level: e.jobRole.level,
    departmentId: e.department?.id ?? null,
    departmentName: e.department?.name ?? null,
    divisionId: e.division?.id ?? null,
    divisionName: e.division?.name ?? null,
    positionId: e.position?.id ?? null,
    positionName: e.position?.name ?? null,
    managerId: e.managerId,
    managerName: e.managerId ? (nameById.get(e.managerId) ?? null) : null,
    hasLogin: Boolean(e.userId),
    reportCount: e._count.reports,
  }));

  const jobRoleRows: JobRoleRow[] = jobRoles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    level: r.level,
    levelRank: r.levelRank,
    gradeFrom: r.gradeFrom,
    gradeTo: r.gradeTo,
    employeeCount: r._count.employees,
    assessedCount: assessedByRole.get(r.id) ?? 0,
  }));

  return {
    employees: rows,
    departments: departments.map(
      (d): OrgUnitRow => ({
        id: d.id,
        name: d.name,
        parentId: null,
        parentName: null,
        employeeCount: d._count.employees,
        childCount: d._count.divisions,
      }),
    ),
    divisions: divisions.map(
      (d): OrgUnitRow => ({
        id: d.id,
        name: d.name,
        parentId: d.departmentId,
        parentName: d.department.name,
        employeeCount: d._count.employees,
        childCount: 0,
      }),
    ),
    positions: positions.map(
      (p): OrgUnitRow => ({
        id: p.id,
        name: p.name,
        parentId: p.departmentId,
        parentName: p.department?.name ?? null,
        employeeCount: p._count.employees,
        childCount: 0,
      }),
    ),
    jobRoles: jobRoleRows,
    counts: {
      active: rows.filter((r) => r.active).length,
      inactive: rows.filter((r) => !r.active).length,
      withLogin: rows.filter((r) => r.hasLogin).length,
    },
  };
}

const employeeFields = z.object({
  // Employee_ID in the HR data set: 3 to 4 letters or digits (also a CHECK in the database)
  employeeCode: z.string().trim().regex(/^[A-Za-z0-9]{3,4}$/, "bad-code"),
  name: shortText,
  nickname: z.string().trim().max(60).optional().default(""),
  email: z.string().trim().email().max(160),
  grade: z.string().trim().max(20).optional().default(""),
  businessUnit: z.string().trim().max(120).optional().default(""),
  remark: longText,
  jobRoleId: idSchema,
  departmentId: z.string().max(64).optional().default(""),
  divisionId: z.string().max(64).optional().default(""),
  positionId: z.string().max(64).optional().default(""),
  managerId: z.string().max(64).optional().default(""),
});

const createEmployeeSchema = employeeFields;
const updateEmployeeSchema = employeeFields.extend({ employeeId: idSchema });

const BAD_EMPLOYEE = fail(
  "An employee needs a name, an employee ID, a valid email and a career role.",
  "ต้องระบุชื่อ รหัสพนักงาน อีเมลที่ถูกต้อง และบทบาทสายอาชีพ",
);
const BAD_CODE = fail(
  "The employee ID must be 3 to 4 letters or digits, as in the HR data set.",
  "รหัสพนักงานต้องเป็นตัวอักษรหรือตัวเลข 3–4 ตัว ตามชุดข้อมูลของฝ่ายบุคคล",
);

function badEmployee(error: z.ZodError) {
  return error.issues.some((i) => i.message === "bad-code") ? BAD_CODE : BAD_EMPLOYEE;
}

/**
 * The org-chart checks a create or an edit both have to pass: the career role
 * has to exist, a division has to sit under the department it was filed against,
 * and a reporting line must not close a loop — "A reports to B reports to A"
 * would send `getTeamSummaries` round forever.
 */
async function validateEmployeeShape(
  d: z.infer<typeof employeeFields>,
  employeeId: string | null,
): Promise<{ ok: false; error: Bilingual } | { ok: true }> {
  const [jobRole, division] = await Promise.all([
    db.jobRole.findUnique({ where: { id: d.jobRoleId }, select: { id: true } }),
    d.divisionId
      ? db.division.findUnique({
          where: { id: d.divisionId },
          select: { departmentId: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  if (!jobRole) {
    return fail("Pick a career role that exists.", "กรุณาเลือกบทบาทสายอาชีพที่มีอยู่จริง");
  }
  if (division && d.departmentId && division.departmentId !== d.departmentId) {
    return fail(
      `"${division.name}" is not a division of the department you picked.`,
      `"${division.name}" ไม่ได้อยู่ภายใต้ฝ่ายที่คุณเลือก`,
    );
  }

  if (d.managerId) {
    if (employeeId && d.managerId === employeeId) {
      return fail(
        "Somebody cannot report to themselves.",
        "พนักงานไม่สามารถเป็นผู้บังคับบัญชาของตนเองได้",
      );
    }
    if (employeeId) {
      // walk up the chain; if we come back to this person, the line is a loop
      let cursor: string | null = d.managerId;
      for (let hops = 0; cursor && hops < 50; hops++) {
        if (cursor === employeeId) {
          return fail(
            "That reporting line loops back on itself.",
            "สายการบังคับบัญชานี้วนกลับมาที่ตัวพนักงานเอง",
          );
        }
        const next: { managerId: string | null } | null = await db.employee.findUnique({
          where: { id: cursor },
          select: { managerId: true },
        });
        cursor = next?.managerId ?? null;
      }
    }
  }
  return { ok: true };
}

function employeeData(d: z.infer<typeof employeeFields>) {
  // the split the login-id rule works from: first word, then the rest
  const [firstName, ...rest] = d.name.split(/\s+/);
  return {
    employeeCode: d.employeeCode,
    name: d.name,
    firstName: firstName || null,
    lastName: rest.join(" ") || null,
    nickname: d.nickname || null,
    email: d.email.toLowerCase(),
    grade: d.grade || null,
    businessUnit: d.businessUnit || null,
    remark: d.remark || null,
    jobRoleId: d.jobRoleId,
    departmentId: d.departmentId || null,
    divisionId: d.divisionId || null,
    positionId: d.positionId || null,
    managerId: d.managerId || null,
  };
}

export async function createEmployee(
  input: z.input<typeof createEmployeeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = createEmployeeSchema.safeParse(input);
    if (!parsed.success) return badEmployee(parsed.error);
    const d = parsed.data;

    const shape = await validateEmployeeShape(d, null);
    if (!shape.ok) return shape;

    const clash = await db.employee.findFirst({
      where: {
        OR: [{ employeeCode: d.employeeCode }, { email: d.email.toLowerCase() }],
      },
      select: { employeeCode: true, email: true },
    });
    if (clash) {
      return clash.employeeCode === d.employeeCode
        ? fail(
            `Employee ID "${d.employeeCode}" is already taken.`,
            `รหัสพนักงาน "${d.employeeCode}" ถูกใช้ไปแล้ว`,
          )
        : fail(
            `"${d.email}" already belongs to another employee.`,
            `อีเมล "${d.email}" ถูกใช้กับพนักงานคนอื่นแล้ว`,
          );
    }

    const employee = await db.employee.create({
      data: employeeData(d),
      select: { id: true, name: true, jobRole: { select: { name: true } } },
    });

    await recordActivity({
      viewer,
      action: "Added employee",
      targetType: "employee",
      targetId: employee.id,
      targetLabel: employee.name,
      detail: `${d.employeeCode} · ${employee.jobRole.name}`,
    });
    revalidateContent();
    return done(
      `${d.name} added. They are assessed on whatever "${employee.jobRole.name}" expects.`,
      `เพิ่ม ${d.name} แล้ว จะถูกประเมินตามที่บทบาท "${employee.jobRole.name}" กำหนด`,
    );
  });
}

export async function updateEmployee(
  input: z.input<typeof updateEmployeeSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = updateEmployeeSchema.safeParse(input);
    if (!parsed.success) return badEmployee(parsed.error);
    const { employeeId, ...d } = parsed.data;

    const existing = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
        jobRoleId: true,
        jobRole: { select: { name: true } },
      },
    });
    if (!existing) {
      return fail("That employee no longer exists.", "ไม่พบพนักงานคนนี้แล้ว");
    }
    // with an account, the email is the login id — it changes in one place only
    if (existing.userId && d.email.toLowerCase() !== existing.email) {
      return fail(
        `${existing.name} signs in with ${existing.email}. Change it from Accounts → Change login ID, so the account and the record stay the same.`,
        `${existing.name} ใช้ ${existing.email} เข้าสู่ระบบ กรุณาเปลี่ยนที่หน้าบัญชีผู้ใช้ → เปลี่ยนไอดีเข้าสู่ระบบ เพื่อให้บัญชีและข้อมูลพนักงานตรงกัน`,
      );
    }

    const shape = await validateEmployeeShape(d, existing.id);
    if (!shape.ok) return shape;

    const clash = await db.employee.findFirst({
      where: {
        id: { not: existing.id },
        OR: [{ employeeCode: d.employeeCode }, { email: d.email.toLowerCase() }],
      },
      select: { employeeCode: true },
    });
    if (clash) {
      return clash.employeeCode === d.employeeCode
        ? fail(
            `Employee ID "${d.employeeCode}" belongs to somebody else.`,
            `รหัสพนักงาน "${d.employeeCode}" เป็นของพนักงานคนอื่น`,
          )
        : fail(
            `"${d.email}" belongs to somebody else.`,
            `อีเมล "${d.email}" เป็นของพนักงานคนอื่น`,
          );
    }

    const roleChanged = existing.jobRoleId !== d.jobRoleId;
    const nextRole = roleChanged
      ? await db.jobRole.findUnique({
          where: { id: d.jobRoleId },
          select: { name: true },
        })
      : null;

    await db.employee.update({ where: { id: existing.id }, data: employeeData(d) });

    await recordActivity({
      viewer,
      action: "Updated employee",
      targetType: "employee",
      targetId: existing.id,
      targetLabel: d.name,
      detail: roleChanged
        ? `Career role ${existing.jobRole.name} → ${nextRole?.name ?? "?"}`
        : "Updated details",
    });
    revalidateContent();
    return roleChanged
      ? done(
          `${d.name} updated. Moving them to "${nextRole?.name}" changes which competencies they are assessed on.`,
          `อัปเดต ${d.name} แล้ว การย้ายไปบทบาท "${nextRole?.name}" จะเปลี่ยนสมรรถนะที่ใช้ประเมิน`,
        )
      : done(`${d.name} updated.`, `อัปเดตข้อมูล ${d.name} แล้ว`);
  });
}

const employeeActiveSchema = z.object({ employeeId: idSchema, active: z.boolean() });

/**
 * Deactivate rather than delete. An employee is the anchor of their scores,
 * certificates, ledger and IDP; removing the row would take all of it with them.
 * Somebody who still has direct reports has to hand them over first, or the
 * people underneath are left reporting to nobody.
 */
export async function setEmployeeActive(
  input: z.input<typeof employeeActiveSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = employeeActiveSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown employee.", "ไม่พบพนักงานที่ระบุ");
    const { employeeId, active } = parsed.data;

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        active: true,
        user: { select: { id: true, status: true } },
        _count: { select: { reports: true } },
      },
    });
    if (!employee) {
      return fail("That employee no longer exists.", "ไม่พบพนักงานคนนี้แล้ว");
    }
    if (!active && employee.user?.id === viewer.userId) {
      return fail(
        "You cannot deactivate your own staff record.",
        "คุณไม่สามารถปิดใช้งานข้อมูลพนักงานของตนเองได้",
      );
    }
    if (!active && employee._count.reports > 0) {
      return fail(
        `${employee._count.reports} ${employee._count.reports === 1 ? "person reports" : "people report"} to ${employee.name}. Move them to another manager first.`,
        `มีพนักงาน ${employee._count.reports} คนอยู่ใต้บังคับบัญชาของ ${employee.name} กรุณาย้ายไปหัวหน้าคนอื่นก่อน`,
      );
    }

    // someone who has left must not keep a working login: deactivating the
    // record suspends the account. Reactivating leaves the account to HROD.
    const suspendLogin = !active && employee.user?.status === "ACTIVE";
    await db.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employee.id }, data: { active } });
      if (suspendLogin && employee.user) {
        await tx.user.update({ where: { id: employee.user.id }, data: { status: "SUSPENDED" } });
        await tx.accessToken.updateMany({
          where: { userId: employee.user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
    });
    await recordActivity({
      viewer,
      action: active ? "Reactivated employee" : "Deactivated employee",
      targetType: "employee",
      targetId: employee.id,
      targetLabel: employee.name,
      detail: suspendLogin ? "Login suspended with the record" : undefined,
    });
    revalidateContent();
    return active
      ? done(
          `${employee.name} is back in the active roster.${employee.user?.status === "SUSPENDED" ? " Their login is still suspended — reactivate it on Accounts." : ""}`,
          `นำ ${employee.name} กลับเข้ารายชื่อพนักงานที่ทำงานอยู่แล้ว${employee.user?.status === "SUSPENDED" ? " บัญชีเข้าสู่ระบบยังถูกระงับ เปิดได้ที่หน้าบัญชีผู้ใช้" : ""}`,
        )
      : done(
          `${employee.name} is deactivated${suspendLogin ? " and their login suspended" : ""}. Their history, scores and certificates are all kept.`,
          `ปิดใช้งาน ${employee.name} แล้ว${suspendLogin ? " และระงับบัญชีเข้าสู่ระบบ" : ""} ประวัติ คะแนน และใบรับรองยังคงอยู่ครบ`,
        );
  });
}

/* ------------------------------------------- departments / divisions / positions */

const orgSchema = z.object({
  entity: z.enum(["department", "division", "position"]),
  /** empty when creating */
  id: z.string().max(64).optional().default(""),
  name: shortText,
  /** the owning department, required for a division */
  parentId: z.string().max(64).optional().default(""),
});

const ORG_NOUN: Record<OrgEntity, Bilingual> = {
  department: { en: "Department", th: "ฝ่าย" },
  division: { en: "Division", th: "แผนก" },
  position: { en: "Position", th: "ตำแหน่ง" },
};

/**
 * One entry point for the three org tabs, because they are genuinely the same
 * operation against three tables — a division simply has to name its department.
 */
export async function saveOrgUnit(
  input: z.input<typeof orgSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = orgSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Give it a name.", "กรุณากรอกชื่อ");
    }
    const { entity, id, name, parentId } = parsed.data;
    const noun = ORG_NOUN[entity];

    if (entity === "division" && !parentId) {
      return fail(
        "A division has to belong to a department.",
        "แผนกต้องสังกัดฝ่ายใดฝ่ายหนึ่ง",
      );
    }
    if (parentId) {
      const parent = await db.department.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        return fail("That department no longer exists.", "ไม่พบฝ่ายนี้แล้ว");
      }
    }

    if (entity === "department") {
      const clash = await db.department.findFirst({
        where: { name, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (clash) {
        return fail(
          `A department called "${name}" already exists.`,
          `มีฝ่ายชื่อ "${name}" อยู่แล้ว`,
        );
      }
      const row = id
        ? await db.department.update({ where: { id }, data: { name } })
        : await db.department.create({ data: { name } });
      await recordActivity({
        viewer,
        action: id ? "Renamed department" : "Created department",
        targetType: "department",
        targetId: row.id,
        targetLabel: name,
      });
    } else if (entity === "division") {
      const clash = await db.division.findFirst({
        where: { name, departmentId: parentId, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (clash) {
        return fail(
          `That department already has a division called "${name}".`,
          `ฝ่ายนี้มีแผนกชื่อ "${name}" อยู่แล้ว`,
        );
      }
      const row = id
        ? await db.division.update({
            where: { id },
            data: { name, departmentId: parentId },
          })
        : await db.division.create({ data: { name, departmentId: parentId } });
      await recordActivity({
        viewer,
        action: id ? "Updated division" : "Created division",
        targetType: "division",
        targetId: row.id,
        targetLabel: name,
      });
    } else {
      const clash = await db.position.findFirst({
        where: {
          name,
          departmentId: parentId || null,
          ...(id ? { id: { not: id } } : {}),
        },
        select: { id: true },
      });
      if (clash) {
        return fail(
          `A position called "${name}" already exists there.`,
          `มีตำแหน่งชื่อ "${name}" อยู่แล้วในฝ่ายนี้`,
        );
      }
      const row = id
        ? await db.position.update({
            where: { id },
            data: { name, departmentId: parentId || null },
          })
        : await db.position.create({
            data: { name, departmentId: parentId || null },
          });
      await recordActivity({
        viewer,
        action: id ? "Updated position" : "Created position",
        targetType: "position",
        targetId: row.id,
        targetLabel: name,
      });
    }

    revalidateContent();
    return id
      ? done(`${noun.en} "${name}" updated.`, `อัปเดต${noun.th} "${name}" แล้ว`)
      : done(`${noun.en} "${name}" created.`, `สร้าง${noun.th} "${name}" แล้ว`);
  });
}

const deleteOrgSchema = z.object({
  entity: z.enum(["department", "division", "position"]),
  id: idSchema,
});

/** Nothing with people in it can be deleted — they would silently lose it. */
export async function deleteOrgUnit(
  input: z.input<typeof deleteOrgSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = deleteOrgSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown record.", "ไม่พบรายการที่ระบุ");
    const { entity, id } = parsed.data;
    const noun = ORG_NOUN[entity];

    const inUse = async (employeeCount: number, extra?: { count: number; en: string; th: string }) => {
      if (extra && extra.count > 0) {
        return fail(
          `"${extra.en}" — move or remove those first.`,
          `"${extra.th}" กรุณาย้ายหรือลบออกก่อน`,
        );
      }
      if (employeeCount > 0) {
        return fail(
          `${employeeCount} employee(s) are filed under this ${noun.en.toLowerCase()}. Move them first.`,
          `มีพนักงาน ${employeeCount} คนอยู่ภายใต้${noun.th}นี้ กรุณาย้ายออกก่อน`,
        );
      }
      return null;
    };

    if (entity === "department") {
      const row = await db.department.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: true, divisions: true, positions: true } },
        },
      });
      if (!row) return fail("That department no longer exists.", "ไม่พบฝ่ายนี้แล้ว");
      const refused = await inUse(row._count.employees, {
        count: row._count.divisions,
        en: `${row.name} still has ${row._count.divisions} division(s)`,
        th: `ฝ่าย ${row.name} ยังมีแผนกอยู่ ${row._count.divisions} แผนก`,
      });
      if (refused) return refused;
      await db.department.delete({ where: { id: row.id } });
      await recordActivity({
        viewer,
        action: "Deleted department",
        targetType: "department",
        targetId: row.id,
        targetLabel: row.name,
      });
      revalidateContent();
      return done(`Department "${row.name}" deleted.`, `ลบฝ่าย "${row.name}" แล้ว`);
    }

    if (entity === "division") {
      const row = await db.division.findUnique({
        where: { id },
        select: { id: true, name: true, _count: { select: { employees: true } } },
      });
      if (!row) return fail("That division no longer exists.", "ไม่พบแผนกนี้แล้ว");
      const refused = await inUse(row._count.employees);
      if (refused) return refused;
      await db.division.delete({ where: { id: row.id } });
      await recordActivity({
        viewer,
        action: "Deleted division",
        targetType: "division",
        targetId: row.id,
        targetLabel: row.name,
      });
      revalidateContent();
      return done(`Division "${row.name}" deleted.`, `ลบแผนก "${row.name}" แล้ว`);
    }

    const row = await db.position.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { employees: true } } },
    });
    if (!row) return fail("That position no longer exists.", "ไม่พบตำแหน่งนี้แล้ว");
    const refused = await inUse(row._count.employees);
    if (refused) return refused;
    await db.position.delete({ where: { id: row.id } });
    await recordActivity({
      viewer,
      action: "Deleted position",
      targetType: "position",
      targetId: row.id,
      targetLabel: row.name,
    });
    revalidateContent();
    return done(`Position "${row.name}" deleted.`, `ลบตำแหน่ง "${row.name}" แล้ว`);
  });
}

/* ------------------------------------------------------------- career roles */

const jobRoleFields = z.object({
  name: shortText,
  level: shortText,
  levelRank: z.coerce.number().int().min(1).max(20),
  gradeFrom: z.string().trim().max(20).optional().default(""),
  gradeTo: z.string().trim().max(20).optional().default(""),
});

const createJobRoleSchema = jobRoleFields;
const updateJobRoleSchema = jobRoleFields.extend({ jobRoleId: idSchema });

const BAD_JOB_ROLE = fail(
  "A career role needs a name and a level.",
  "บทบาทสายอาชีพต้องมีชื่อและระดับ",
);

export async function createJobRole(
  input: z.input<typeof createJobRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = createJobRoleSchema.safeParse(input);
    if (!parsed.success) return BAD_JOB_ROLE;
    const d = parsed.data;

    const clash = await db.jobRole.findUnique({
      where: { name: d.name },
      select: { id: true },
    });
    if (clash) {
      return fail(
        `A career role called "${d.name}" already exists.`,
        `มีบทบาทสายอาชีพชื่อ "${d.name}" อยู่แล้ว`,
      );
    }

    const key = await uniqueKey(slugify(d.name, "role"), async (k) =>
      Boolean(await db.jobRole.findUnique({ where: { key: k }, select: { id: true } })),
    );
    const last = await db.jobRole.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const role = await db.jobRole.create({
      data: {
        key,
        name: d.name,
        level: d.level,
        levelRank: d.levelRank,
        gradeFrom: d.gradeFrom || "—",
        gradeTo: d.gradeTo || d.gradeFrom || "—",
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      select: { id: true, name: true },
    });

    await recordActivity({
      viewer,
      action: "Created career role",
      targetType: "jobRole",
      targetId: role.id,
      targetLabel: role.name,
      detail: `${d.level} (rank ${d.levelRank}) — no expected levels yet`,
    });
    revalidateContent();
    return done(
      `"${d.name}" created. It is assessed on nothing until you set its expected levels on the Assessment screen.`,
      `สร้างบทบาท "${d.name}" แล้ว จะยังไม่ถูกประเมินสมรรถนะใดจนกว่าจะกำหนดระดับที่คาดหวังในหน้าจัดการการประเมิน`,
    );
  });
}

export async function updateJobRole(
  input: z.input<typeof updateJobRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = updateJobRoleSchema.safeParse(input);
    if (!parsed.success) return BAD_JOB_ROLE;
    const { jobRoleId, ...d } = parsed.data;

    const role = await db.jobRole.findUnique({
      where: { id: jobRoleId },
      select: { id: true, name: true },
    });
    if (!role) {
      return fail("That career role no longer exists.", "ไม่พบบทบาทสายอาชีพนี้แล้ว");
    }
    const clash = await db.jobRole.findFirst({
      where: { name: d.name, id: { not: role.id } },
      select: { id: true },
    });
    if (clash) {
      return fail(
        `A career role called "${d.name}" already exists.`,
        `มีบทบาทสายอาชีพชื่อ "${d.name}" อยู่แล้ว`,
      );
    }

    await db.jobRole.update({
      where: { id: role.id },
      data: {
        name: d.name,
        level: d.level,
        levelRank: d.levelRank,
        gradeFrom: d.gradeFrom || "—",
        gradeTo: d.gradeTo || d.gradeFrom || "—",
      },
    });
    await recordActivity({
      viewer,
      action: "Updated career role",
      targetType: "jobRole",
      targetId: role.id,
      targetLabel: d.name,
      detail: role.name === d.name ? "Updated details" : `Renamed from ${role.name}`,
    });
    revalidateContent();
    return done(`"${d.name}" updated.`, `อัปเดตบทบาท "${d.name}" แล้ว`);
  });
}

const deleteJobRoleSchema = z.object({ jobRoleId: idSchema });

export async function deleteJobRole(
  input: z.input<typeof deleteJobRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = deleteJobRoleSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown career role.", "ไม่พบบทบาทที่ระบุ");

    const role = await db.jobRole.findUnique({
      where: { id: parsed.data.jobRoleId },
      select: { id: true, name: true, _count: { select: { employees: true } } },
    });
    if (!role) {
      return fail("That career role no longer exists.", "ไม่พบบทบาทสายอาชีพนี้แล้ว");
    }
    if (role._count.employees > 0) {
      return fail(
        `${role._count.employees} employee(s) hold "${role.name}". Move them to another career role first — deleting it would delete its expected levels with it.`,
        `มีพนักงาน ${role._count.employees} คนอยู่ในบทบาท "${role.name}" กรุณาย้ายไปบทบาทอื่นก่อน เพราะการลบจะลบระดับที่คาดหวังของบทบาทนี้ไปด้วย`,
      );
    }

    await db.jobRole.delete({ where: { id: role.id } });
    await recordActivity({
      viewer,
      action: "Deleted career role",
      targetType: "jobRole",
      targetId: role.id,
      targetLabel: role.name,
    });
    revalidateContent();
    return done(
      `"${role.name}" deleted, along with its expected-level column.`,
      `ลบบทบาท "${role.name}" พร้อมคอลัมน์ระดับที่คาดหวังแล้ว`,
    );
  });
}

/* ==========================================================================
   /admin/lms — the course library
   ========================================================================== */

export async function getLmsAdminData(): Promise<LmsAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_LMS);

  const [courses, competencies] = await Promise.all([
    db.course.findMany({
      orderBy: [{ status: "asc" }, { titleEn: "asc" }],
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleTh: true,
        descriptionEn: true,
        descriptionTh: true,
        category: true,
        competencyId: true,
        hours: true,
        cover: true,
        status: true,
        competency: { select: { nameEn: true } },
        chapters: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            sortOrder: true,
            kind: true,
            titleEn: true,
            titleTh: true,
            summaryEn: true,
            summaryTh: true,
            minutes: true,
            pages: true,
          },
        },
        _count: {
          select: { enrollments: true, certificates: true, pathSteps: true },
        },
      },
    }),
    db.competency.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      select: { id: true, key: true, group: true, nameEn: true, nameTh: true },
    }),
  ]);

  // "how many finished it" in one grouped query rather than one per course
  const completed = await db.enrollment.groupBy({
    by: ["courseId"],
    where: { completedAt: { not: null } },
    _count: { _all: true },
  });
  const completedByCourse = new Map(completed.map((g) => [g.courseId, g._count._all]));

  const rows: AdminCourseRow[] = courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    titleEn: c.titleEn,
    titleTh: c.titleTh,
    descriptionEn: c.descriptionEn,
    descriptionTh: c.descriptionTh,
    category: c.category,
    competencyId: c.competencyId,
    competencyName: c.competency?.nameEn ?? null,
    hours: c.hours,
    cover: c.cover,
    status: c.status,
    chapters: c.chapters,
    enrolledCount: c._count.enrollments,
    completedCount: completedByCourse.get(c.id) ?? 0,
    certificateCount: c._count.certificates,
    pathStepCount: c._count.pathSteps,
  }));

  return {
    courses: rows,
    competencies,
    counts: {
      total: rows.length,
      published: rows.filter((c) => c.status === "PUBLISHED").length,
      draft: rows.filter((c) => c.status === "DRAFT").length,
      archived: rows.filter((c) => c.status === "ARCHIVED").length,
      chapters: rows.reduce((a, c) => a + c.chapters.length, 0),
      taggedCompetencies: new Set(
        rows.map((c) => c.competencyId).filter(Boolean),
      ).size,
    },
  };
}

const chapterSchema = z.object({
  /** a cuid for a chapter that already exists, empty for a new one */
  id: z.string().max(64).optional().default(""),
  kind: z.enum(["VIDEO", "PDF", "ARTICLE"]),
  titleEn: shortText,
  titleTh: optionalText,
  summaryEn: z.string().trim().max(1000).optional().default(""),
  summaryTh: z.string().trim().max(1000).optional().default(""),
  minutes: z.coerce.number().int().min(0).max(1000),
  pages: z.coerce.number().int().min(0).max(5000).optional(),
});

const courseFields = z.object({
  titleEn: shortText,
  titleTh: optionalText,
  descriptionEn: longText,
  descriptionTh: longText,
  category: z.enum(["CORE", "FUNCTIONAL", "MANAGERIAL"]),
  competencyId: z.string().max(64).optional().default(""),
  hours: z.coerce.number().int().min(0).max(1000),
  cover: z.string().trim().max(120).optional().default(""),
  chapters: z.array(chapterSchema).max(60),
});

const saveCourseSchema = courseFields.extend({
  /** empty when creating */
  courseId: z.string().max(64).optional().default(""),
});

const BAD_COURSE = fail(
  "A course needs a title and a category.",
  "หลักสูตรต้องมีชื่อและหมวดหมู่",
);

/**
 * Create or update a course and its chapters in one transaction.
 *
 * Chapters are reconciled rather than wiped and rewritten: a chapter that keeps
 * its id keeps its `ChapterProgress`, so re-ordering a syllabus does not quietly
 * mark everybody's finished lessons unfinished. `Chapter` is unique on
 * (course, sortOrder), so every surviving row is pushed out of the way first and
 * then dropped onto its final position — otherwise swapping chapters 1 and 2
 * collides halfway through.
 */
export async function saveCourse(
  input: z.input<typeof saveCourseSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_LMS, async (viewer) => {
    const parsed = saveCourseSchema.safeParse(input);
    if (!parsed.success) return BAD_COURSE;
    const { courseId, chapters, ...d } = parsed.data;

    if (d.competencyId) {
      const competency = await db.competency.findUnique({
        where: { id: d.competencyId },
        select: { id: true },
      });
      if (!competency) {
        return fail("That competency no longer exists.", "ไม่พบสมรรถนะนี้แล้ว");
      }
    }

    const existing = courseId
      ? await db.course.findUnique({
          where: { id: courseId },
          select: { id: true, titleEn: true, status: true },
        })
      : null;
    if (courseId && !existing) {
      return fail("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว");
    }

    const data = {
      titleEn: d.titleEn,
      titleTh: d.titleTh || null,
      descriptionEn: d.descriptionEn || null,
      descriptionTh: d.descriptionTh || null,
      category: d.category,
      competencyId: d.competencyId || null,
      hours: d.hours,
      cover: d.cover || null,
    };

    const id = await db.$transaction(async (tx) => {
      let target = existing?.id ?? "";
      if (target) {
        await tx.course.update({ where: { id: target }, data });
      } else {
        const slug = await uniqueKey(slugify(d.titleEn, "course"), async (k) =>
          Boolean(
            await tx.course.findUnique({ where: { slug: k }, select: { id: true } }),
          ),
        );
        // a new course starts as a draft: nothing reaches learners by accident
        const created = await tx.course.create({
          data: { ...data, slug, status: "DRAFT" },
          select: { id: true },
        });
        target = created.id;
      }

      const keptIds = chapters.map((c) => c.id).filter(Boolean);
      await tx.chapter.deleteMany({
        where: { courseId: target, id: { notIn: keptIds.length ? keptIds : ["-"] } },
      });
      // park the survivors above every final position so re-ordering cannot clash
      await tx.chapter.updateMany({
        where: { courseId: target },
        data: { sortOrder: { increment: 1000 } },
      });

      for (const [index, ch] of chapters.entries()) {
        const body = {
          sortOrder: index,
          kind: ch.kind,
          titleEn: ch.titleEn,
          titleTh: ch.titleTh || null,
          summaryEn: ch.summaryEn || null,
          summaryTh: ch.summaryTh || null,
          minutes: ch.minutes,
          pages: ch.kind === "PDF" ? (ch.pages ?? null) : null,
        };
        if (ch.id) {
          await tx.chapter.update({ where: { id: ch.id }, data: body });
        } else {
          await tx.chapter.create({ data: { ...body, courseId: target } });
        }
      }

      return target;
    });

    await recordActivity({
      viewer,
      action: existing ? "Updated course" : "Created course",
      targetType: "course",
      targetId: id,
      targetLabel: d.titleEn,
      detail: `${chapters.length} chapter(s), ${d.hours}h`,
    });
    revalidateContent("/lms");
    return existing
      ? done(
          `"${d.titleEn}" updated — ${chapters.length} chapter(s).`,
          `อัปเดต "${d.titleTh || d.titleEn}" แล้ว — ${chapters.length} บทเรียน`,
        )
      : done(
          `"${d.titleEn}" created as a draft. Publish it when the syllabus is ready.`,
          `สร้าง "${d.titleTh || d.titleEn}" เป็นฉบับร่างแล้ว กดเผยแพร่เมื่อเนื้อหาพร้อม`,
        );
  });
}

const courseStatusSchema = z.object({
  courseId: idSchema,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function setCourseStatus(
  input: z.input<typeof courseStatusSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_LMS, async (viewer) => {
    const parsed = courseStatusSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown course.", "ไม่พบหลักสูตรที่ระบุ");
    const { courseId, status } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        titleEn: true,
        titleTh: true,
        status: true,
        _count: { select: { chapters: true, enrollments: true } },
      },
    });
    if (!course) return fail("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว");

    if (status === "PUBLISHED" && course._count.chapters === 0) {
      return fail(
        `"${course.titleEn}" has no chapters yet. Publishing an empty course puts a dead end in somebody's learning path.`,
        `"${course.titleTh ?? course.titleEn}" ยังไม่มีบทเรียน การเผยแพร่หลักสูตรเปล่าจะทำให้เส้นทางการเรียนรู้ของพนักงานตัน`,
      );
    }

    await db.course.update({ where: { id: course.id }, data: { status } });
    await recordActivity({
      viewer,
      action:
        status === "PUBLISHED"
          ? "Published course"
          : status === "ARCHIVED"
            ? "Archived course"
            : "Unpublished course",
      targetType: "course",
      targetId: course.id,
      targetLabel: course.titleEn,
      detail: `${course.status} → ${status}`,
    });
    revalidateContent("/lms");

    if (status === "PUBLISHED") {
      return done(
        `"${course.titleEn}" is live in the library.`,
        `"${course.titleTh ?? course.titleEn}" เผยแพร่ในคลังหลักสูตรแล้ว`,
      );
    }
    if (status === "ARCHIVED") {
      return done(
        `"${course.titleEn}" is archived. The ${course._count.enrollments} people already enrolled keep their progress.`,
        `เก็บ "${course.titleTh ?? course.titleEn}" เข้าคลังแล้ว ผู้ที่ลงทะเบียนไว้ ${course._count.enrollments} คนยังคงความคืบหน้าเดิม`,
      );
    }
    return done(
      `"${course.titleEn}" is back to draft and hidden from the library.`,
      `เปลี่ยน "${course.titleTh ?? course.titleEn}" กลับเป็นฉบับร่างและซ่อนจากคลังหลักสูตรแล้ว`,
    );
  });
}

const deleteCourseSchema = z.object({ courseId: idSchema });

/**
 * Deleting is refused as soon as anything real hangs off the course — an
 * enrolment, a certificate or a step of a learning path. Archiving is the answer
 * for a course that has simply stopped being offered.
 */
export async function deleteCourse(
  input: z.input<typeof deleteCourseSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_LMS, async (viewer) => {
    const parsed = deleteCourseSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown course.", "ไม่พบหลักสูตรที่ระบุ");

    const course = await db.course.findUnique({
      where: { id: parsed.data.courseId },
      select: {
        id: true,
        titleEn: true,
        titleTh: true,
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            pathSteps: true,
            idpGoals: true,
            chapters: true,
          },
        },
      },
    });
    if (!course) return fail("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว");

    const c = course._count;
    if (c.enrollments || c.certificates || c.pathSteps || c.idpGoals) {
      const parts = [
        c.enrollments ? `${c.enrollments} enrolment(s)` : null,
        c.certificates ? `${c.certificates} certificate(s)` : null,
        c.pathSteps ? `${c.pathSteps} learning-path step(s)` : null,
        c.idpGoals ? `${c.idpGoals} development goal(s)` : null,
      ].filter(Boolean);
      return fail(
        `"${course.titleEn}" still has ${parts.join(", ")}. Archive it instead — deleting it would take that with it.`,
        `"${course.titleTh ?? course.titleEn}" ยังมีข้อมูลเชื่อมโยงอยู่ (${parts.join(", ")}) กรุณาเก็บเข้าคลังแทน เพราะการลบจะทำให้ข้อมูลเหล่านั้นหายไปด้วย`,
      );
    }

    await db.course.delete({ where: { id: course.id } });
    await recordActivity({
      viewer,
      action: "Deleted course",
      targetType: "course",
      targetId: course.id,
      targetLabel: course.titleEn,
      detail: `${c.chapters} chapter(s)`,
    });
    revalidateContent("/lms");
    return done(
      `"${course.titleEn}" and its ${c.chapters} chapter(s) deleted.`,
      `ลบ "${course.titleTh ?? course.titleEn}" พร้อมบทเรียน ${c.chapters} บทแล้ว`,
    );
  });
}

/* ==========================================================================
   /admin/assessment — the cycle, the weighting and the framework itself
   ========================================================================== */

const cellKey = (jobRoleId: string, competencyId: string) =>
  `${jobRoleId}:${competencyId}`;

export async function getAssessmentAdminData(): Promise<AssessmentAdminData> {
  await assertPermission(PERMISSIONS.MANAGE_CYCLE);

  const cycle = await currentCycleRow();

  const [jobRoles, competencies, expected, workforce, employeesByRole, scores] =
    await Promise.all([
      db.jobRole.findMany({
        orderBy: [{ sortOrder: "asc" }, { levelRank: "asc" }],
        select: {
          id: true,
          name: true,
          level: true,
          levelRank: true,
          _count: { select: { employees: true } },
        },
      }),
      db.competency.findMany({
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          key: true,
          group: true,
          nameEn: true,
          nameTh: true,
          definitionEn: true,
          definitionTh: true,
          levels: {
            orderBy: { score: "asc" },
            select: {
              score: true,
              labelEn: true,
              labelTh: true,
              descEn: true,
              descTh: true,
            },
          },
        },
      }),
      db.expectedLevel.findMany({
        select: { jobRoleId: true, competencyId: true, level: true },
      }),
      loadWorkforce(cycle?.id ?? null),
      db.employee.findMany({
        where: { active: true },
        select: { id: true, jobRoleId: true },
      }),
      // every score in the open cycle, so the blast radius of a matrix edit can
      // be shown before it is applied rather than discovered afterwards
      cycle
        ? db.assessmentScore.findMany({
            where: { assessment: { cycleId: cycle.id } },
            select: {
              competencyId: true,
              assessment: { select: { subjectId: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const matrix: Record<string, number | null> = {};
  let assessedCells = 0;
  for (const e of expected) {
    matrix[cellKey(e.jobRoleId, e.competencyId)] = e.level;
    if (e.level !== null) assessedCells++;
  }

  const roleOfEmployee = new Map(employeesByRole.map((e) => [e.id, e.jobRoleId]));
  const scoredPairs = new Map<string, Set<string>>();
  for (const s of scores) {
    const roleId = roleOfEmployee.get(s.assessment.subjectId);
    if (!roleId) continue;
    const key = cellKey(roleId, s.competencyId);
    const set = scoredPairs.get(key) ?? new Set<string>();
    set.add(s.assessment.subjectId);
    scoredPairs.set(key, set);
  }
  const scored: Record<string, number> = {};
  for (const [key, people] of scoredPairs) scored[key] = people.size;

  const employees: CycleStatusRow[] = workforce.rows.map((r) => ({
    id: r.id,
    name: r.name,
    jobRoleName: r.jobRoleName,
    level: r.level,
    departmentName: r.departmentName,
    assessedCount: r.assessedCount,
    phase: r.phase,
    selfSubmitted: r.selfSubmitted,
    supervisorSubmitted: r.supervisorSubmitted,
  }));

  return {
    cycle: cycle ? toCycleSummary(cycle) : null,
    jobRoles: jobRoles.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      levelRank: r.levelRank,
      employeeCount: r._count.employees,
    })),
    competencies: competencies as MatrixCompetency[],
    matrix,
    scored,
    employees,
    counts: {
      headcount: employees.length,
      selfSubmitted: workforce.selfSubmittedCount,
      supervisorSubmitted: workforce.supervisorSubmittedCount,
      assessedCells,
      notAssessedCells: jobRoles.length * competencies.length - assessedCells,
    },
  };
}

const cycleSchema = z.object({
  /** empty creates the first cycle */
  cycleId: z.string().max(64).optional().default(""),
  nameEn: shortText,
  nameTh: shortText,
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  status: z.enum(["DRAFT", "OPEN", "REVIEW", "CLOSED"]),
});

export async function saveCycle(
  input: z.input<typeof cycleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_CYCLE, async (viewer) => {
    const parsed = cycleSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "A cycle needs a name in both languages and a valid start and end date.",
        "รอบการประเมินต้องมีชื่อทั้งสองภาษา และวันที่เริ่ม-สิ้นสุดที่ถูกต้อง",
      );
    }
    const d = parsed.data;
    const startsAt = new Date(`${d.startsAt}T00:00:00.000Z`);
    const endsAt = new Date(`${d.endsAt}T00:00:00.000Z`);
    if (endsAt <= startsAt) {
      return fail(
        "The cycle has to close after it opens.",
        "วันสิ้นสุดรอบต้องอยู่หลังวันเริ่มรอบ",
      );
    }

    const existing = d.cycleId
      ? await db.assessmentCycle.findUnique({
          where: { id: d.cycleId },
          select: { id: true, nameEn: true, status: true },
        })
      : null;
    if (d.cycleId && !existing) {
      return fail("That cycle no longer exists.", "ไม่พบรอบการประเมินนี้แล้ว");
    }

    if (existing) {
      await db.assessmentCycle.update({
        where: { id: existing.id },
        data: {
          nameEn: d.nameEn,
          nameTh: d.nameTh,
          startsAt,
          endsAt,
          status: d.status,
        },
      });
      await recordActivity({
        viewer,
        action: "Updated assessment cycle",
        targetType: "cycle",
        targetId: existing.id,
        targetLabel: d.nameEn,
        detail: `${d.startsAt} → ${d.endsAt}, ${existing.status} → ${d.status}`,
      });
      revalidateContent("/assessment");
      return done(
        `"${d.nameEn}" saved — ${d.startsAt} to ${d.endsAt}.`,
        `บันทึกรอบ "${d.nameTh}" แล้ว — ${d.startsAt} ถึง ${d.endsAt}`,
      );
    }

    const key = await uniqueKey(slugify(d.nameEn, "cycle"), async (k) =>
      Boolean(
        await db.assessmentCycle.findUnique({ where: { key: k }, select: { id: true } }),
      ),
    );
    const created = await db.assessmentCycle.create({
      data: {
        key,
        nameEn: d.nameEn,
        nameTh: d.nameTh,
        startsAt,
        endsAt,
        status: d.status,
      },
      select: { id: true },
    });
    await recordActivity({
      viewer,
      action: "Created assessment cycle",
      targetType: "cycle",
      targetId: created.id,
      targetLabel: d.nameEn,
      detail: `${d.startsAt} → ${d.endsAt}`,
    });
    revalidateContent("/assessment");
    return done(
      `"${d.nameEn}" created — ${d.startsAt} to ${d.endsAt}.`,
      `สร้างรอบ "${d.nameTh}" แล้ว — ${d.startsAt} ถึง ${d.endsAt}`,
    );
  });
}

const weightsSchema = z.object({
  cycleId: idSchema,
  kpi: z.coerce.number().int().min(0).max(100),
  core: z.coerce.number().int().min(0).max(100),
  functional: z.coerce.number().int().min(0).max(100),
  managerial: z.coerce.number().int().min(0).max(100),
});

/**
 * The four weight columns.
 *
 * The 100% rule is enforced here, not only by the sliders: a client that posts
 * 40/40/40/40 is refused. The UI keeping them balanced is a convenience; this is
 * the rule.
 */
export async function updateCycleWeights(
  input: z.input<typeof weightsSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_CYCLE, async (viewer) => {
    const parsed = weightsSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "Each weight has to be a whole percentage between 0 and 100.",
        "น้ำหนักแต่ละส่วนต้องเป็นจำนวนเต็มระหว่าง 0 ถึง 100",
      );
    }
    const { cycleId, kpi, core, functional, managerial } = parsed.data;
    const total = kpi + core + functional + managerial;
    if (total !== 100) {
      return fail(
        `The four sections add up to ${total}%. They have to make exactly 100%.`,
        `ผลรวมทั้งสี่ส่วนได้ ${total}% ต้องเท่ากับ 100% พอดี`,
      );
    }

    const cycle = await db.assessmentCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        nameEn: true,
        nameTh: true,
        weightKpi: true,
        weightCore: true,
        weightFunctional: true,
        weightManagerial: true,
      },
    });
    if (!cycle) return fail("That cycle no longer exists.", "ไม่พบรอบการประเมินนี้แล้ว");

    await db.assessmentCycle.update({
      where: { id: cycle.id },
      data: {
        weightKpi: kpi,
        weightCore: core,
        weightFunctional: functional,
        weightManagerial: managerial,
      },
    });
    await recordActivity({
      viewer,
      action: "Updated score weighting",
      targetType: "cycle",
      targetId: cycle.id,
      targetLabel: cycle.nameEn,
      detail: `KPI ${cycle.weightKpi}→${kpi}, Core ${cycle.weightCore}→${core}, Functional ${cycle.weightFunctional}→${functional}, Managerial ${cycle.weightManagerial}→${managerial}`,
    });
    revalidateContent("/assessment");
    return done(
      `Weighting saved — KPI ${kpi}%, Core ${core}%, Functional ${functional}%, Managerial ${managerial}%.`,
      `บันทึกการถ่วงน้ำหนักแล้ว — KPI ${kpi}% Core ${core}% Functional ${functional}% Managerial ${managerial}%`,
    );
  });
}

const expectedLevelSchema = z.object({
  jobRoleId: idSchema,
  competencyId: idSchema,
  /** 1-4, or null for "this role is not assessed on this competency" */
  level: z.union([z.coerce.number().int().min(1).max(4), z.null()]),
});

/**
 * One cell of the expected-level matrix.
 *
 * This is the screen where the framework genuinely becomes editable, and it is
 * the most consequential write in the product: a null means that career role is
 * **not assessed** on that competency, so the competency disappears from the gap
 * report of everybody who holds the role — it is never rendered as a zero. Their
 * existing scores are not deleted; they simply stop being counted, which is why
 * the result says how many of them there were.
 */
export async function setExpectedLevel(
  input: z.input<typeof expectedLevelSchema>,
): Promise<ExpectedLevelResult> {
  let viewer: Viewer;
  try {
    viewer = await assertPermission(PERMISSIONS.MANAGE_FRAMEWORK);
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return fail(err.message, "คุณไม่มีสิทธิ์แก้ไขกรอบสมรรถนะ");
    }
    throw err;
  }

  const parsed = expectedLevelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "An expected level is 1 to 4, or Not assessed.",
      "ระดับที่คาดหวังต้องเป็น 1 ถึง 4 หรือ ไม่ประเมิน",
    );
  }
  const { jobRoleId, competencyId, level } = parsed.data;

  const [jobRole, competency, current] = await Promise.all([
    db.jobRole.findUnique({
      where: { id: jobRoleId },
      select: { id: true, name: true, _count: { select: { employees: true } } },
    }),
    db.competency.findUnique({
      where: { id: competencyId },
      select: { id: true, nameEn: true, nameTh: true },
    }),
    db.expectedLevel.findUnique({
      where: { jobRoleId_competencyId: { jobRoleId, competencyId } },
      select: { level: true },
    }),
  ]);
  if (!jobRole) {
    return fail("That career role no longer exists.", "ไม่พบบทบาทสายอาชีพนี้แล้ว");
  }
  if (!competency) {
    return fail("That competency no longer exists.", "ไม่พบสมรรถนะนี้แล้ว");
  }

  const from = current?.level ?? null;
  if (from === level) {
    return fail(
      "That cell already says exactly this.",
      "ช่องนี้มีค่าดังกล่าวอยู่แล้ว",
    );
  }

  // how many people carry a score for this competency today — the ones whose
  // gap report changes shape the moment this is saved
  const cycle = await currentCycleRow();
  const scoresOrphaned = cycle
    ? await db.assessmentScore.count({
        where: {
          competencyId,
          assessment: { cycleId: cycle.id, subject: { jobRoleId, active: true } },
        },
      })
    : 0;

  await db.expectedLevel.upsert({
    where: { jobRoleId_competencyId: { jobRoleId, competencyId } },
    create: { jobRoleId, competencyId, level },
    update: { level },
  });

  await recordActivity({
    viewer,
    action:
      level === null ? "Removed competency from career role" : "Set expected level",
    targetType: "expectedLevel",
    targetId: `${jobRoleId}:${competencyId}`,
    targetLabel: `${jobRole.name} — ${competency.nameEn}`,
    detail: `${from ?? "not assessed"} → ${level ?? "not assessed"}, ${jobRole._count.employees} employee(s)`,
  });
  revalidateContent("/assessment", "/dashboard", "/team-profile", "/reports", "/idp");

  const outcome: ExpectedLevelOutcome = {
    jobRoleName: jobRole.name,
    competencyNameEn: competency.nameEn,
    competencyNameTh: competency.nameTh,
    from,
    to: level,
    employeesAffected: jobRole._count.employees,
    scoresOrphaned,
  };

  if (level === null) {
    return {
      ok: true,
      message: msg(
        `${jobRole.name} is no longer assessed on "${competency.nameEn}". It disappears from ${jobRole._count.employees} people's gap report${scoresOrphaned ? `, and ${scoresOrphaned} existing score(s) stop being counted` : ""}.`,
        `บทบาท ${jobRole.name} จะไม่ถูกประเมินสมรรถนะ "${competency.nameTh ?? competency.nameEn}" อีกต่อไป จะหายไปจากรายงานช่องว่างของพนักงาน ${jobRole._count.employees} คน${scoresOrphaned ? ` และคะแนนเดิม ${scoresOrphaned} รายการจะไม่ถูกนำมาคิด` : ""}`,
      ),
      outcome,
    };
  }

  return {
    ok: true,
    message: msg(
      from === null
        ? `${jobRole.name} is now assessed on "${competency.nameEn}" at level ${level}. ${jobRole._count.employees} people gain a competency they had not been measured on.`
        : `${jobRole.name} now expects level ${level} on "${competency.nameEn}" (was ${from}). ${jobRole._count.employees} people's gaps are recalculated.`,
      from === null
        ? `บทบาท ${jobRole.name} จะถูกประเมินสมรรถนะ "${competency.nameTh ?? competency.nameEn}" ที่ระดับ ${level} พนักงาน ${jobRole._count.employees} คนจะมีสมรรถนะเพิ่มขึ้นหนึ่งรายการ`
        : `บทบาท ${jobRole.name} คาดหวังระดับ ${level} ในสมรรถนะ "${competency.nameTh ?? competency.nameEn}" (เดิม ${from}) ระบบจะคำนวณช่องว่างของพนักงาน ${jobRole._count.employees} คนใหม่`,
    ),
    outcome,
  };
}
