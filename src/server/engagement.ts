"use server";

/**
 * Points, rewards, certificates and badges — the engagement half of the product,
 * read from and written to Postgres.
 *
 * Two rules decide the shape of everything below.
 *
 * 1. **The balance is never stored.** It is `SUM(PointLedger.delta)`, so it is
 *    always explainable and two concurrent awards cannot clobber one another.
 *    "Points spent" is the sum of the viewer's `Redemption` rows and "total
 *    earned" is balance + spent, which is why the three tiles on /reward always
 *    reconcile: they are one number and two derivations of it.
 *
 * 2. **Redeeming is money-like.** The price, the balance and the stock are all
 *    re-read inside a serialisable transaction from the database rows, never
 *    from anything the browser sent. A client that posts a cheaper price, or two
 *    tabs that click Redeem on the last item at the same moment, cannot get past
 *    it.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS, can } from "@/lib/permissions";
import {
  NotAuthorised,
  assertEmployee,
  assertPermission,
  recordActivity,
  type Viewer,
} from "@/server/session";
import { getActiveCycle, getPointsBalance, getPointsLeaderboard } from "@/server/competency";
import type {
  Bilingual,
  RedeemResult,
  RewardScreenData,
} from "@/app/(app)/reward/types";
import type {
  AchievementsScreenData,
  BadgeCard,
  BadgeSourceValue,
  CertificateCard,
  LeaderRow,
} from "@/app/(app)/achievements/types";

/* ------------------------------------------------------------------ plumbing */

const msg = (en: string, th: string): Bilingual => ({ en, th });

/**
 * A refusal. Typed as the failure arm alone rather than as a whole
 * `ActionResult`, so it also satisfies richer results like `RedeemResult`.
 */
const fail = (en: string, th: string): { ok: false; error: Bilingual } => ({
  ok: false,
  error: msg(en, th),
});

/** How many rows the leaderboard ranks. Wide enough to hold the whole company. */
const BOARD_LIMIT = 200;

/**
 * Anyone on these screens needs both a staff record and the reward permission.
 * The page redirects; this throws, because an action is the only real gate.
 */
async function assertParticipant(): Promise<Viewer & { employeeId: string }> {
  const viewer = await assertEmployee();
  await assertPermission(PERMISSIONS.REDEEM_REWARDS);
  return viewer;
}

/* ==========================================================================
   /reward
   ========================================================================== */

export async function getRewardScreenData(): Promise<RewardScreenData> {
  const viewer = await assertParticipant();
  const employeeId = viewer.employeeId;

  const [balance, spentAgg, rewards, history] = await Promise.all([
    getPointsBalance(employeeId),
    db.redemption.aggregate({
      where: { employeeId, status: { not: "CANCELLED" } },
      _sum: { points: true },
      _count: true,
    }),
    db.reward.findMany({
      where: { active: true },
      orderBy: { points: "asc" },
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTh: true,
        points: true,
        stock: true,
        tone: true,
        image: true,
      },
    }),
    db.redemption.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rewardId: true,
        points: true,
        status: true,
        createdAt: true,
        reward: { select: { nameEn: true, nameTh: true } },
      },
    }),
  ]);

  const spent = spentAgg._sum.points ?? 0;

  return {
    balance,
    spent,
    // the ledger already has the negative entries in it, so what this person has
    // ever earned is what they still hold plus what they have spent
    totalEarned: balance + spent,
    redeemedCount: spentAgg._count,
    rewards,
    history: history.map((r) => ({
      id: r.id,
      rewardId: r.rewardId,
      nameEn: r.reward.nameEn,
      nameTh: r.reward.nameTh,
      points: r.points,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

const redeemSchema = z.object({ rewardId: z.string().min(1).max(64) });

type RedeemVerdict =
  | { kind: "missing" }
  | { kind: "insufficient"; balance: number; price: number; nameEn: string; nameTh: string | null }
  | { kind: "out-of-stock"; nameEn: string; nameTh: string | null }
  | {
      kind: "ok";
      nameEn: string;
      nameTh: string | null;
      price: number;
      balanceAfter: number;
      redemptionId: string;
    };

/**
 * Redeem one reward.
 *
 * The browser sends an id and nothing else. Everything that decides the outcome
 * — the price, the current balance, whether anything is left — is read inside
 * the transaction, and the three writes (stock down, ledger entry, redemption
 * row) either all happen or none do.
 *
 * The stock decrement is a conditional `updateMany` rather than a read followed
 * by a write, so it is a single atomic statement: the row is claimed only while
 * `stock > 0`, and a second request that loses the race sees `count === 0`
 * instead of pushing the stock negative. `Serializable` covers the balance read
 * the same way, and a genuine write conflict comes back as a retry message
 * rather than a half-applied redemption.
 */
export async function redeemReward(
  input: z.input<typeof redeemSchema>,
): Promise<RedeemResult> {
  let viewer: Viewer & { employeeId: string };
  try {
    viewer = await assertParticipant();
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return fail(err.message, "คุณไม่มีสิทธิ์แลกของรางวัล");
    }
    throw err;
  }

  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Pick a reward to redeem.", "กรุณาเลือกของรางวัลที่ต้องการแลก");
  }
  const employeeId = viewer.employeeId;

  let verdict: RedeemVerdict;
  try {
    verdict = await db.$transaction(
      async (tx): Promise<RedeemVerdict> => {
        const reward = await tx.reward.findUnique({
          where: { id: parsed.data.rewardId },
          select: { id: true, nameEn: true, nameTh: true, points: true, active: true },
        });
        if (!reward || !reward.active) return { kind: "missing" };

        // the price is the column, not whatever the client believes it to be
        const agg = await tx.pointLedger.aggregate({
          where: { employeeId },
          _sum: { delta: true },
        });
        const balance = agg._sum.delta ?? 0;
        if (balance < reward.points) {
          return {
            kind: "insufficient",
            balance,
            price: reward.points,
            nameEn: reward.nameEn,
            nameTh: reward.nameTh,
          };
        }

        const claimed = await tx.reward.updateMany({
          where: { id: reward.id, active: true, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (claimed.count !== 1) {
          return { kind: "out-of-stock", nameEn: reward.nameEn, nameTh: reward.nameTh };
        }

        const redemption = await tx.redemption.create({
          data: {
            employeeId,
            rewardId: reward.id,
            points: reward.points,
            status: "PREPARING",
          },
          select: { id: true },
        });
        await tx.pointLedger.create({
          data: {
            employeeId,
            delta: -reward.points,
            reason: `Redeemed ${reward.nameEn}`,
            refType: "redemption",
            refId: redemption.id,
          },
        });

        return {
          kind: "ok",
          nameEn: reward.nameEn,
          nameTh: reward.nameTh,
          price: reward.points,
          balanceAfter: balance - reward.points,
          redemptionId: redemption.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    // P2034: the database refused to serialise this against a concurrent write.
    // Nothing was committed, so the honest answer is "try that again".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return fail(
        "Someone redeemed at the same moment. Nothing was deducted — please try again.",
        "มีการแลกของรางวัลพร้อมกันพอดี ยังไม่มีการหักคะแนน กรุณาลองใหม่อีกครั้ง",
      );
    }
    throw err;
  }

  if (verdict.kind === "missing") {
    return fail(
      "That reward is no longer in the catalogue.",
      "ของรางวัลนี้ไม่มีอยู่ในรายการแล้ว",
    );
  }
  if (verdict.kind === "insufficient") {
    const short = verdict.price - verdict.balance;
    return fail(
      `"${verdict.nameEn}" costs ${verdict.price} points and you have ${verdict.balance}. You need ${short} more.`,
      `"${verdict.nameTh ?? verdict.nameEn}" ใช้ ${verdict.price} คะแนน แต่คุณมี ${verdict.balance} คะแนน ยังขาดอีก ${short} คะแนน`,
    );
  }
  if (verdict.kind === "out-of-stock") {
    return fail(
      `"${verdict.nameEn}" is out of stock. No points were deducted.`,
      `"${verdict.nameTh ?? verdict.nameEn}" หมดแล้ว ระบบไม่ได้หักคะแนนของคุณ`,
    );
  }

  await recordActivity({
    viewer,
    action: "Redeemed reward",
    targetType: "redemption",
    targetId: verdict.redemptionId,
    targetLabel: verdict.nameEn,
    detail: `-${verdict.price} points, balance ${verdict.balanceAfter}`,
  });
  revalidatePath("/reward");
  revalidatePath("/achievements");
  revalidatePath("/admin/reward");

  return {
    ok: true,
    message: msg(
      `Redeemed "${verdict.nameEn}" for ${verdict.price} points. ${verdict.balanceAfter} left.`,
      `แลก "${verdict.nameTh ?? verdict.nameEn}" ด้วย ${verdict.price} คะแนนแล้ว คงเหลือ ${verdict.balanceAfter} คะแนน`,
    ),
    outcome: {
      rewardNameEn: verdict.nameEn,
      rewardNameTh: verdict.nameTh,
      points: verdict.price,
      balanceAfter: verdict.balanceAfter,
    },
  };
}

/* ==========================================================================
   /achievements
   ========================================================================== */

const BADGE_SOURCES: BadgeSourceValue[] = [
  "courses",
  "certificates",
  "assessments",
  "paths",
  "manual",
];

const asSource = (value: string): BadgeSourceValue =>
  (BADGE_SOURCES as string[]).includes(value) ? (value as BadgeSourceValue) : "manual";

export async function getAchievementsScreenData(): Promise<AchievementsScreenData> {
  const viewer = await assertParticipant();
  const employeeId = viewer.employeeId;
  const canSeeTeam = can(viewer.permissions, PERMISSIONS.SEE_TEAM_RESULT);

  const cycle = await getActiveCycle();

  // certificates the viewer is allowed to look at: their own, plus their direct
  // reports' when their role says they may see the team at all
  const certificateScope = canSeeTeam
    ? { employeeId: { in: [employeeId, ...viewer.reportIds] } }
    : { employeeId };

  const [
    leaderboard,
    certificates,
    badges,
    held,
    coursesCompleted,
    certificatesEarned,
    assessmentsSubmitted,
    pathsFinished,
    pathsAvailable,
  ] = await Promise.all([
    getPointsLeaderboard(BOARD_LIMIT),
    db.certificate.findMany({
      where: certificateScope,
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        code: true,
        titleEn: true,
        titleTh: true,
        score: true,
        issuedAt: true,
        courseId: true,
        pathId: true,
        employeeId: true,
        employee: { select: { name: true } },
      },
    }),
    db.badge.findMany({
      where: { active: true },
      orderBy: [{ points: "desc" }, { nameEn: "asc" }],
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTh: true,
        requirementEn: true,
        requirementTh: true,
        tone: true,
        points: true,
        source: true,
        target: true,
      },
    }),
    db.employeeBadge.findMany({
      where: { employeeId },
      select: { badgeId: true, earnedAt: true },
    }),
    db.enrollment.count({ where: { employeeId, completedAt: { not: null } } }),
    db.certificate.count({ where: { employeeId } }),
    // "submitted an assessment" means the person's own self assessment in the
    // open cycle — a supervisor review they wrote about someone else is not it
    cycle
      ? db.assessment.count({
          where: {
            cycleId: cycle.id,
            subjectId: employeeId,
            mode: "SELF",
            submittedAt: { not: null },
          },
        })
      : Promise.resolve(0),
    db.pathCompletion.count({ where: { employeeId } }),
    db.learningPath.count({ where: { status: "PUBLISHED" } }),
  ]);

  const board: LeaderRow[] = leaderboard.map((row) => ({
    rank: row.rank,
    employeeId: row.employeeId,
    name: row.name,
    position: row.position,
    points: row.points,
    isViewer: row.employeeId === employeeId,
  }));

  const counters = {
    coursesCompleted,
    certificatesEarned,
    assessmentsSubmitted,
    pathsFinished,
    pathsAvailable,
  };

  const counterFor = (source: BadgeSourceValue): number | null => {
    switch (source) {
      case "courses":
        return coursesCompleted;
      case "certificates":
        return certificatesEarned;
      case "assessments":
        return assessmentsSubmitted;
      case "paths":
        return pathsFinished;
      default:
        return null;
    }
  };

  const heldById = new Map(held.map((h) => [h.badgeId, h.earnedAt]));

  const badgeCards: BadgeCard[] = badges
    .map((b): BadgeCard => {
      const source = asSource(b.source);
      const current = counterFor(source);
      const awarded = heldById.get(b.id) ?? null;
      // a badge is earned when it was granted outright, or when the counter its
      // source names has reached the target — no cached "earned" flag anywhere
      const reached = current !== null && b.target !== null && current >= b.target;
      return {
        id: b.id,
        key: b.key,
        nameEn: b.nameEn,
        nameTh: b.nameTh,
        requirementEn: b.requirementEn,
        requirementTh: b.requirementTh,
        tone: b.tone,
        points: b.points,
        source,
        target: b.target,
        earned: Boolean(awarded) || reached,
        earnedAt: awarded ? awarded.toISOString() : null,
        current: current === null ? null : b.target === null ? current : Math.min(current, b.target),
      };
    })
    // the ones with a live counter lead the collection, as they always did
    .sort((a, b) => Number(b.source !== "manual") - Number(a.source !== "manual"));

  const cards: CertificateCard[] = certificates.map((c) => ({
    id: c.id,
    code: c.code,
    titleEn: c.titleEn,
    titleTh: c.titleTh,
    holderName: c.employee.name,
    isMine: c.employeeId === employeeId,
    score: c.score,
    issuedAt: c.issuedAt.toISOString(),
    kind: c.pathId ? "PATH" : c.courseId ? "COURSE" : "OTHER",
  }));

  const viewerRow = board.find((r) => r.isViewer) ?? null;

  return {
    board,
    viewerRow,
    certificates: cards,
    myCertificateCount: cards.filter((c) => c.isMine).length,
    visibleCertificateCount: cards.length,
    canSeeTeamCertificates: canSeeTeam && cards.some((c) => !c.isMine),
    badges: badgeCards,
    counters,
  };
}
