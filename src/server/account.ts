"use server";

/**
 * The person's side of their own account: activating it from the link an
 * administrator sent, and changing their password afterwards.
 *
 * Activation runs without a session — the link is the credential — so every
 * check is made against the token row, inside one transaction, and the token is
 * spent in the same write that sets the password.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import {
  createOneTimeToken,
  hashPassword,
  hashToken,
  passwordProblems,
  verifyPassword,
  type PasswordProblem,
} from "@/lib/password";
import { assertViewer, NotAuthorised, recordActivity } from "@/server/session";

/** The link made when someone presses Start is short-lived: they use it now. */
const STARTED_RESET_TTL_MS = 30 * 60 * 1000;

/**
 * Start: spend the pending request and hand back a fresh one-time link for
 * this person alone. Only a signed-in person with an open request gets one.
 */
export async function startPasswordReset(): Promise<
  { ok: true; path: string } | { ok: false; reason: "none" }
> {
  let viewer;
  try {
    viewer = await assertViewer();
  } catch {
    return { ok: false, reason: "none" };
  }
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const spent = await tx.accessToken.updateMany({
      where: {
        userId: viewer.userId,
        purpose: "RESET",
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (spent.count === 0) return null;
    const { token, tokenHash } = createOneTimeToken();
    await tx.accessToken.create({
      data: {
        userId: viewer.userId,
        purpose: "RESET",
        tokenHash,
        expiresAt: new Date(now.getTime() + STARTED_RESET_TTL_MS),
        createdById: viewer.userId,
      },
    });
    if (viewer.employeeId) {
      await tx.notification.updateMany({
        where: { employeeId: viewer.employeeId, href: "/account/reset", readAt: null },
        data: { readAt: now },
      });
    }
    return token;
  });
  if (!result) return { ok: false, reason: "none" };
  return { ok: true, path: `/activate/${result}` };
}

export type LinkState =
  | { state: "valid"; loginId: string; name: string; purpose: "ACTIVATE" | "RESET" }
  | { state: "invalid" | "expired" | "used" };

/** What the activation page shows. Read-only: looking at a link does not spend it. */
export async function inspectLink(token: string): Promise<LinkState> {
  if (!token || token.length > 100) return { state: "invalid" };
  const row = await db.accessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      purpose: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { email: true, name: true, status: true } },
    },
  });
  if (!row || row.user.status === "SUSPENDED") return { state: "invalid" };
  if (row.usedAt) return { state: "used" };
  if (row.expiresAt <= new Date()) return { state: "expired" };
  return {
    state: "valid",
    loginId: row.user.email,
    name: row.user.name ?? row.user.email,
    purpose: row.purpose,
  };
}

export type SetPasswordResult =
  | { ok: true; loginId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "mismatch" }
  | { ok: false; reason: "weak"; problems: PasswordProblem[] };

const activateSchema = z.object({
  token: z.string().min(10).max(100),
  password: z.string().max(200),
  confirm: z.string().max(200),
});

export async function completeActivation(
  input: z.input<typeof activateSchema>,
): Promise<SetPasswordResult> {
  const parsed = activateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { token, password, confirm } = parsed.data;

  const problems = passwordProblems(password);
  if (problems.length) return { ok: false, reason: "weak", problems };
  if (password !== confirm) return { ok: false, reason: "mismatch" };

  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const row = await tx.accessToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        purpose: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { id: true, email: true, name: true, status: true } },
      },
    });
    if (!row || row.user.status === "SUSPENDED") {
      return { ok: false, reason: "invalid" } as const;
    }
    if (row.usedAt) return { ok: false, reason: "used" } as const;
    if (row.expiresAt <= new Date()) return { ok: false, reason: "expired" } as const;

    // spend it first, conditionally — two tabs submitting at once cannot both win
    const spent = await tx.accessToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (spent.count !== 1) return { ok: false, reason: "used" } as const;

    const now = new Date();
    await tx.user.update({
      where: { id: row.user.id },
      data: {
        passwordHash,
        passwordSetAt: now,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        status: "ACTIVE",
      },
    });
    // and any other link this person was sent
    await tx.accessToken.updateMany({
      where: { userId: row.user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.activityLog.create({
      data: {
        actorId: row.user.id,
        actorLabel: row.user.name ?? row.user.email,
        action: row.purpose === "ACTIVATE" ? "Activated account" : "Reset password",
        targetType: "user",
        targetId: row.user.id,
        targetLabel: row.user.email,
      },
    });
    return { ok: true, loginId: row.user.email } as const;
  });
}

const changeSchema = z.object({
  current: z.string().max(200),
  password: z.string().max(200),
  confirm: z.string().max(200),
});

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong_current" | "mismatch" | "same" | "not_allowed" }
  | { ok: false; reason: "weak"; problems: PasswordProblem[] };

/** A signed-in person changing their own password. Other sessions are retired. */
export async function changeOwnPassword(
  input: z.input<typeof changeSchema>,
): Promise<ChangePasswordResult> {
  let viewer;
  try {
    viewer = await assertViewer();
  } catch (err) {
    if (err instanceof NotAuthorised) return { ok: false, reason: "not_allowed" };
    throw err;
  }
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "wrong_current" };
  const { current, password, confirm } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return { ok: false, reason: "not_allowed" };
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, reason: "wrong_current" };
  }
  const problems = passwordProblems(password);
  if (problems.length) return { ok: false, reason: "weak", problems };
  if (password !== confirm) return { ok: false, reason: "mismatch" };
  if (password === current) return { ok: false, reason: "same" };

  await db.user.update({
    where: { id: viewer.userId },
    data: {
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      mustChangePassword: false,
    },
  });
  await recordActivity({
    viewer,
    action: "Changed password",
    targetType: "user",
    targetId: viewer.userId,
    targetLabel: viewer.email,
  });
  return { ok: true };
}
