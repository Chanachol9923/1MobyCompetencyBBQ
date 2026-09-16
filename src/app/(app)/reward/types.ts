/**
 * View models for `/reward`.
 *
 * They live outside `src/server/engagement.ts` because that module carries
 * `"use server"` and may only export async functions. The server never picks a
 * language: it hands both columns down and the screen chooses with `useT()`.
 */

import type { ActionResult, Bilingual } from "@/components/admin/admin-types";

export type { ActionResult, Bilingual };

export type RedemptionStatusValue = "PREPARING" | "DELIVERED" | "CANCELLED";

/** One catalogue entry, with the stock figure the server will re-check anyway. */
export type RewardCard = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string | null;
  points: number;
  stock: number;
  /** the tailwind gradient string from the seed data, for `coverStyle` */
  tone: string | null;
  /** icon slug: voucher | gold | tshirt | tumbler */
  image: string | null;
};

/** A row of the viewer's own redemption history. */
export type RedemptionRow = {
  id: string;
  rewardId: string;
  nameEn: string;
  nameTh: string | null;
  points: number;
  status: RedemptionStatusValue;
  /** ISO timestamp */
  createdAt: string;
};

export type RewardScreenData = {
  /** summed from the append-only ledger, never a stored total */
  balance: number;
  /** the sum of every redemption this person has made */
  spent: number;
  /** balance + spent, so the three tiles always reconcile */
  totalEarned: number;
  redeemedCount: number;
  rewards: RewardCard[];
  history: RedemptionRow[];
};

/** What a successful redemption tells the screen, so it can show the new balance. */
export type RedeemOutcome = {
  rewardNameEn: string;
  rewardNameTh: string | null;
  points: number;
  balanceAfter: number;
};

/**
 * A redemption answers with the same shape every other action uses — so the
 * shared `ResultBanner` renders it — plus the numbers the screen needs to show
 * what just happened. A refusal (not enough points, nothing left in stock) is a
 * value, not a throw.
 */
export type RedeemResult =
  | { ok: true; message: Bilingual; outcome: RedeemOutcome }
  | { ok: false; error: Bilingual };
