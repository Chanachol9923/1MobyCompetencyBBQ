"use server";

/**
 * Account lifecycle, roles/permissions and the audit trail — the three surfaces
 * that decide who can do what.
 *
 * Everything here is an async, permission-guarded entry point. Reads assert the
 * permission of the screen that shows them; writes assert, validate with zod,
 * record an activity row and revalidate. No caller may hand in an id and have it
 * trusted: every id is re-read from the database before it is used.
 *
 * Lock-out is the risk that matters on these screens. An administrator who can
 * suspend themselves, hand their own account a role without `manage_roles`, or
 * revoke `manage_roles` from the last role that has it, has locked the whole
 * organisation out of its own permission model with no way back short of SQL.
 * Those moves are refused *here*, in the action — not merely greyed out in the
 * UI, which a crafted request would walk straight past.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS, PERMISSION_CATALOGUE } from "@/lib/permissions";
import {
  LOGIN_DOMAIN,
  isValidLoginId,
  normaliseLoginId,
  suggestLoginId,
} from "@/lib/login-id";
import { createOneTimeToken } from "@/lib/password";
import {
  NotAuthorised,
  assertPermission,
  recordActivity,
  type Viewer,
} from "@/server/session";
import type {
  AccountProposal,
  ActionResult,
  AdminUserRow,
  BulkLinkResult,
  AuditPage,
  Bilingual,
  EmployeePickerData,
  IssuedLink,
  LinkResult,
  PermissionRow,
  RoleSummary,
  RolesScreenData,
  UsersScreenData,
} from "@/components/admin/admin-types";

/* ------------------------------------------------------------------ plumbing */

const ADMIN_PATHS = [
  "/admin/employee",
  "/admin/employee/accounts",
  "/admin/roles",
  "/admin/audit",
];

function revalidateAdmin() {
  for (const p of ADMIN_PATHS) revalidatePath(p);
}

const msg = (en: string, th: string): Bilingual => ({ en, th });
// narrow on purpose: a refusal fits both ActionResult and LinkResult
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

/** `guarded` for the actions that hand back a one-time link. */
async function guardedLink(
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  run: (viewer: Viewer) => Promise<LinkResult>,
): Promise<LinkResult> {
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

/** Would anyone other than this user / this role still hold `key`? */
async function someoneElseStillHolds(
  key: string,
  exclude: { userId?: string; roleId?: string },
): Promise<boolean> {
  const count = await db.user.count({
    where: {
      status: "ACTIVE",
      ...(exclude.userId ? { id: { not: exclude.userId } } : {}),
      ...(exclude.roleId ? { roleId: { not: exclude.roleId } } : {}),
      role: { permissions: { some: { permission: { key } } } },
    },
  });
  return count > 0;
}

async function loadRoleSummaries(): Promise<RoleSummary[]> {
  const roles = await db.role.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      key: true,
      nameEn: true,
      nameTh: true,
      description: true,
      isSystem: true,
      sortOrder: true,
      _count: { select: { users: true } },
      permissions: { select: { permissionId: true } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    nameEn: r.nameEn,
    nameTh: r.nameTh,
    description: r.description,
    isSystem: r.isSystem,
    sortOrder: r.sortOrder,
    userCount: r._count.users,
    permissionIds: r.permissions.map((p) => p.permissionId),
  }));
}

/* ==========================================================================
   /admin/users — account lifecycle

   provision (PENDING) ──activation link──▶ ACTIVE ◀──▶ SUSPENDED
                                              │
                                        reset link (stays ACTIVE)

   Nobody can create their own account. An administrator assigns the company
   login id (name.sur@1moby.com), links the staff record and picks the role.
   The person then sets their own password through a one-time link, so no
   administrator ever knows it.
   ========================================================================== */

const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

/** Where links point. Configured origin first, the request's own host otherwise. */
async function appOrigin(): Promise<string> {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Issue a fresh one-time link and retire any earlier unused one — only the
 * newest link a person was sent should work.
 */
async function issueLink(
  tx: Prisma.TransactionClient,
  userId: string,
  purpose: "ACTIVATE" | "RESET",
  createdById: string,
): Promise<{ path: string; expiresAt: Date }> {
  const now = new Date();
  await tx.accessToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });
  const { token, tokenHash } = createOneTimeToken();
  const expiresAt = new Date(
    now.getTime() + (purpose === "ACTIVATE" ? ACTIVATION_TTL_MS : RESET_TTL_MS),
  );
  await tx.accessToken.create({
    data: { userId, purpose, tokenHash, expiresAt, createdById },
  });
  return { path: `/activate/${token}`, expiresAt };
}

/** How long a reset request waits in someone's notifications. */
const RESET_REQUEST_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Ask someone to set a new password, in the app rather than by a link the
 * administrator has to pass on. It lands in their notifications and as a
 * banner, and stays until they press Start — which is the moment the one-time
 * link is made, for them only. Needs a staff record (notifications belong to
 * one) and a way in: someone who cannot sign in anywhere needs a link instead.
 */
export async function requestPasswordReset(
  input: z.input<typeof userOnlySchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = userOnlySchema.safeParse(input);
    if (!parsed.success) return fail("Unknown account.", "ไม่พบบัญชีผู้ใช้");
    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        passwordSetAt: true,
        employee: { select: { id: true, name: true } },
      },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (user.status !== "ACTIVE" || !user.passwordSetAt) {
      return fail(
        "This account has not been activated yet — send it an activation link instead.",
        "บัญชีนี้ยังไม่ได้เปิดใช้งาน กรุณาส่งลิงก์เปิดใช้งานแทน",
      );
    }
    if (!user.employee) {
      return fail(
        "This account has no staff record, so it has no notifications. Use a link instead.",
        "บัญชีนี้ไม่มีข้อมูลพนักงาน จึงไม่มีการแจ้งเตือน กรุณาใช้ลิงก์แทน",
      );
    }
    const employee = user.employee;
    const expiresAt = new Date(Date.now() + RESET_REQUEST_TTL_MS);

    await db.$transaction(async (tx) => {
      // the request itself: an open RESET token nobody holds. Pressing Start
      // spends it and issues the real link.
      await tx.accessToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.accessToken.create({
        data: {
          userId: user.id,
          purpose: "RESET",
          tokenHash: createOneTimeToken().tokenHash,
          expiresAt,
          createdById: viewer.userId,
        },
      });
      await tx.notification.create({
        data: {
          employeeId: employee.id,
          kind: "SYSTEM",
          titleEn: "Set a new password",
          titleTh: "ตั้งรหัสผ่านใหม่",
          bodyEn: `${viewer.name} asked you to set a new password. Open this and press Start.`,
          bodyTh: `${viewer.name} ขอให้คุณตั้งรหัสผ่านใหม่ เปิดรายการนี้แล้วกดเริ่ม`,
          href: "/account/reset",
        },
      });
    });

    await recordActivity({
      viewer,
      action: "Requested password reset",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: "Sent to their notifications",
    });
    revalidateAdmin();
    return done(
      `Sent to ${employee.name}'s notifications. It waits there until they press Start (valid 72 hours).`,
      `ส่งไปที่การแจ้งเตือนของ ${employee.name} แล้ว จะค้างอยู่จนกว่าจะกดเริ่ม (ใช้ได้ 72 ชั่วโมง)`,
    );
  });
}

const USER_ROW_SELECT = {
  id: true,
  email: true,
  name: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  passwordSetAt: true,
  role: { select: { id: true, key: true, nameEn: true, nameTh: true } },
  employee: {
    select: {
      id: true,
      name: true,
      employeeCode: true,
      jobRole: { select: { name: true } },
    },
  },
  accessTokens: {
    where: { usedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { purpose: true, expiresAt: true },
  },
} satisfies Prisma.UserSelect;

type UserRowSource = Prisma.UserGetPayload<{ select: typeof USER_ROW_SELECT }>;

function toUserRow(u: UserRowSource, viewerUserId: string): AdminUserRow {
  const now = Date.now();
  const link = u.accessTokens[0];
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    roleId: u.role?.id ?? null,
    roleKey: u.role?.key ?? null,
    roleNameEn: u.role?.nameEn ?? null,
    roleNameTh: u.role?.nameTh ?? null,
    employeeId: u.employee?.id ?? null,
    employeeName: u.employee?.name ?? null,
    employeeCode: u.employee?.employeeCode ?? null,
    jobRoleName: u.employee?.jobRole.name ?? null,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    lockedUntil:
      u.lockedUntil && u.lockedUntil.getTime() > now ? u.lockedUntil.toISOString() : null,
    hasPassword: u.passwordSetAt !== null,
    openLink: link
      ? {
          purpose: link.purpose,
          expiresAt: link.expiresAt.toISOString(),
          expired: link.expiresAt.getTime() <= now,
        }
      : null,
    isSelf: u.id === viewerUserId,
  };
}

export async function getUsersScreenData(): Promise<UsersScreenData> {
  const viewer = await assertPermission(PERMISSIONS.MANAGE_USERS);

  // PENDING is the first value of the UserStatus enum, so ascending order puts
  // the accounts still waiting on someone at the top. Newest first inside.
  const [users, roles, withoutAccount] = await Promise.all([
    db.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: USER_ROW_SELECT,
    }),
    loadRoleSummaries(),
    db.employee.count({ where: { userId: null, active: true } }),
  ]);

  const rows = users.map((u) => toUserRow(u, viewer.userId));
  return {
    rows,
    roles,
    loginDomain: LOGIN_DOMAIN,
    counts: {
      pending: rows.filter((r) => r.status === "PENDING").length,
      active: rows.filter((r) => r.status === "ACTIVE").length,
      suspended: rows.filter((r) => r.status === "SUSPENDED").length,
      total: rows.length,
      withoutAccount,
    },
  };
}

const pickerSchema = z.object({
  /** when relinking an existing account, its email drives the "matches" hint */
  userId: z.string().max(64).optional().default(""),
  query: z.string().max(120).optional().default(""),
});

/**
 * Staff records with no account yet — for creating one, or linking an existing
 * account. The search runs in the query; the "matches" hint is resolved from
 * the account's own email as read from the database, never from the browser.
 */
export async function searchLinkableEmployees(
  input: z.input<typeof pickerSchema>,
): Promise<EmployeePickerData> {
  await assertPermission(PERMISSIONS.MANAGE_USERS);
  const parsed = pickerSchema.safeParse(input);
  if (!parsed.success) return { options: [], suggestedId: null, truncated: false };
  const { userId, query } = parsed.data;

  const user = userId
    ? await db.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null;

  const q = query.trim();
  const where: Prisma.EmployeeWhereInput = {
    userId: null,
    active: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { employeeCode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const LIMIT = 40;
  const [rows, total, suggested] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      take: LIMIT,
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        jobRole: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
    db.employee.count({ where }),
    user
      ? db.employee.findFirst({
          where: { email: user.email, userId: null, active: true },
          select: { id: true },
        })
      : null,
  ]);

  return {
    options: rows.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      employeeCode: e.employeeCode,
      jobRoleName: e.jobRole.name,
      departmentName: e.department?.name ?? null,
    })),
    suggestedId: suggested?.id ?? null,
    truncated: total > rows.length,
  };
}

/** Is this login id free? Taken by anyone, or used as another person's work email. */
async function loginIdClash(loginId: string, exceptUserId?: string, exceptEmployeeId?: string) {
  const [user, employee] = await Promise.all([
    db.user.findUnique({ where: { email: loginId }, select: { id: true } }),
    db.employee.findUnique({ where: { email: loginId }, select: { id: true } }),
  ]);
  if (user && user.id !== exceptUserId) return true;
  if (employee && employee.id !== exceptEmployeeId) return true;
  return false;
}

type ProposalSource = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

/**
 * Every address already spoken for — logins and work emails — except the
 * person's own work email, which is theirs to use as their login id.
 */
async function takenAddresses(): Promise<Map<string, string | null>> {
  const [users, staff] = await Promise.all([
    db.user.findMany({ select: { email: true } }),
    db.employee.findMany({ select: { id: true, email: true } }),
  ]);
  const taken = new Map<string, string | null>();
  for (const u of users) taken.set(u.email, null);
  for (const e of staff) if (!taken.has(e.email)) taken.set(e.email, e.id);
  return taken;
}

/**
 * The login id the naming rule gives a person. A work email that already has
 * the right shape is kept; otherwise name.sur@, with a digit on a clash.
 */
function loginIdFor(e: ProposalSource, taken: Map<string, string | null>): string | null {
  const own = normaliseLoginId(e.email);
  if (isValidLoginId(own) && (!taken.has(own) || taken.get(own) === e.id)) return own;
  const [first, ...rest] = e.name.split(/\s+/);
  const blocked = new Set([...taken].filter(([, owner]) => owner !== e.id).map(([email]) => email));
  return suggestLoginId(e.firstName ?? first ?? "", e.lastName ?? rest.join(" "), blocked);
}

async function defaultRoleIds() {
  const roles = await db.role.findMany({
    where: { key: { in: ["employee", "manager"] } },
    select: { id: true, key: true },
  });
  return new Map(roles.map((r) => [r.key, r.id]));
}

const proposalSchema = z.object({ employeeId: idSchema });

/**
 * What the create dialog pre-fills for a person: the login id the naming rule
 * gives and the role their position implies. Both are only proposals — the
 * administrator can change either before saving.
 */
export async function proposeAccount(
  input: z.input<typeof proposalSchema>,
): Promise<AccountProposal | null> {
  await assertPermission(PERMISSIONS.MANAGE_USERS);
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return null;

  const employee = await db.employee.findUnique({
    where: { id: parsed.data.employeeId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      _count: { select: { reports: true } },
    },
  });
  if (!employee) return null;

  const [taken, roles] = await Promise.all([takenAddresses(), defaultRoleIds()]);
  return {
    loginId: loginIdFor(employee, taken) ?? "",
    roleId: roles.get(employee._count.reports > 0 ? "manager" : "employee") ?? null,
  };
}

/**
 * Onboarding in one go: an account for every active staff record that has
 * none, each with the id the naming rule gives and the role their position
 * implies, and a list of activation links to hand out. People whose romanised
 * name gives no usable id are skipped and named, for the one-by-one dialog.
 */
export async function createMissingAccounts(): Promise<BulkLinkResult> {
  let viewer: Viewer;
  try {
    viewer = await assertPermission(PERMISSIONS.MANAGE_USERS);
  } catch (err) {
    if (err instanceof NotAuthorised) return fail(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้");
    throw err;
  }

  const [staff, taken, roles] = await Promise.all([
    db.employee.findMany({
      where: { userId: null, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        _count: { select: { reports: true } },
      },
    }),
    takenAddresses(),
    defaultRoleIds(),
  ]);
  if (staff.length === 0) {
    return fail("Every active staff member already has an account.", "พนักงานทุกคนมีบัญชีแล้ว");
  }

  const origin = await appOrigin();
  const links: IssuedLink[] = [];
  const skipped: string[] = [];
  for (const e of staff) {
    const loginId = loginIdFor(e, taken);
    if (!loginId) {
      skipped.push(e.name);
      continue;
    }
    taken.set(loginId, e.id);
    const roleId = roles.get(e._count.reports > 0 ? "manager" : "employee") ?? null;
    const link = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: loginId, name: e.name, status: "PENDING", roleId },
        select: { id: true },
      });
      await tx.employee.update({
        where: { id: e.id },
        data: { userId: user.id, email: loginId },
      });
      return issueLink(tx, user.id, "ACTIVATE", viewer.userId);
    });
    links.push({
      url: `${origin}${link.path}`,
      expiresAt: link.expiresAt.toISOString(),
      purpose: "ACTIVATE",
      loginId,
      name: e.name,
    });
  }

  await recordActivity({
    viewer,
    action: "Created accounts in bulk",
    targetType: "user",
    detail: `${links.length} created${skipped.length ? `, ${skipped.length} skipped` : ""}`,
  });
  revalidateAdmin();
  return {
    ok: true,
    message: msg(
      `${links.length} account(s) created.${skipped.length ? ` Skipped ${skipped.join(", ")} — no usable English name; create those one by one.` : ""}`,
      `สร้างบัญชีแล้ว ${links.length} บัญชี${skipped.length ? ` ข้าม ${skipped.join(", ")} เพราะไม่มีชื่อภาษาอังกฤษที่ใช้สร้างไอดีได้ กรุณาสร้างทีละบัญชี` : ""}`,
    ),
    links,
  };
}

const createSchema = z.object({
  /** empty for an account with no staff record, e.g. another HROD administrator */
  employeeId: z.string().max(64).optional().default(""),
  loginId: z.string().trim().min(3).max(120),
  displayName: z.string().trim().max(120).optional().default(""),
  roleId: idSchema,
});

export async function createAccount(
  input: z.input<typeof createSchema>,
): Promise<LinkResult> {
  return guardedLink(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Fill in the login id and pick a role.", "กรุณากรอกไอดีเข้าสู่ระบบและเลือกบทบาท");
    }
    const loginId = normaliseLoginId(parsed.data.loginId);
    const { employeeId, displayName, roleId } = parsed.data;

    if (!isValidLoginId(loginId)) {
      return fail(
        `The login id must look like name.sur@${LOGIN_DOMAIN} — lower-case letters, one dot, optionally a number.`,
        `ไอดีเข้าสู่ระบบต้องอยู่ในรูปแบบ name.sur@${LOGIN_DOMAIN} (ตัวอักษรภาษาอังกฤษพิมพ์เล็ก จุดหนึ่งตัว และตัวเลขต่อท้ายได้)`,
      );
    }

    const [role, employee] = await Promise.all([
      db.role.findUnique({ where: { id: roleId }, select: { id: true, nameEn: true } }),
      employeeId
        ? db.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, name: true, userId: true, email: true },
          })
        : null,
    ]);
    if (!role) return fail("That role no longer exists.", "ไม่พบบทบาทนี้แล้ว");
    if (employeeId && !employee) {
      return fail("That employee no longer exists.", "ไม่พบข้อมูลพนักงานนี้แล้ว");
    }
    if (employee?.userId) {
      return fail(
        `${employee.name} already has an account.`,
        `${employee.name} มีบัญชีอยู่แล้ว`,
      );
    }
    if (!employee && !displayName) {
      return fail(
        "An account without a staff record needs a display name.",
        "บัญชีที่ไม่ผูกกับข้อมูลพนักงานต้องระบุชื่อที่แสดง",
      );
    }
    if (await loginIdClash(loginId, undefined, employee?.id)) {
      return fail(
        `${loginId} is already in use. Add a digit, e.g. ${loginId.replace("@", "2@")}.`,
        `${loginId} ถูกใช้แล้ว ลองเติมตัวเลข เช่น ${loginId.replace("@", "2@")}`,
      );
    }

    const name = employee?.name ?? displayName;
    const { user, link } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: loginId, name, status: "PENDING", roleId: role.id },
        select: { id: true },
      });
      if (employee) {
        // the login id is the person's company address from now on
        await tx.employee.update({
          where: { id: employee.id },
          data: { userId: user.id, email: loginId },
        });
      }
      const link = await issueLink(tx, user.id, "ACTIVATE", viewer.userId);
      return { user, link };
    });

    await recordActivity({
      viewer,
      action: "Created account",
      targetType: "user",
      targetId: user.id,
      targetLabel: loginId,
      detail: `${role.nameEn}${employee ? ` · linked to ${employee.name}` : " · no staff record"}`,
    });
    revalidateAdmin();
    return {
      ok: true,
      message: msg(
        `Account ${loginId} created. Send the activation link to ${name}.`,
        `สร้างบัญชี ${loginId} แล้ว ส่งลิงก์เปิดใช้งานให้ ${name}`,
      ),
      link: {
        url: `${await appOrigin()}${link.path}`,
        expiresAt: link.expiresAt.toISOString(),
        purpose: "ACTIVATE",
        loginId,
        name,
      },
    };
  });
}

const userOnlySchema = z.object({ userId: idSchema });

/**
 * A new one-time link: activation for an account that was never activated,
 * a password reset for one that was. Any earlier link stops working.
 */
export async function issueAccessLink(
  input: z.input<typeof userOnlySchema>,
): Promise<LinkResult> {
  return guardedLink(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = userOnlySchema.safeParse(input);
    if (!parsed.success) return fail("Unknown account.", "ไม่พบบัญชีผู้ใช้");
    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, name: true, status: true, passwordSetAt: true },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (user.status === "SUSPENDED") {
      return fail(
        "Reactivate the account before sending it a link.",
        "กรุณาเปิดใช้งานบัญชีก่อนส่งลิงก์",
      );
    }

    const purpose = user.passwordSetAt ? "RESET" : "ACTIVATE";
    const link = await db.$transaction((tx) => issueLink(tx, user.id, purpose, viewer.userId));

    await recordActivity({
      viewer,
      action: purpose === "RESET" ? "Issued password reset link" : "Issued activation link",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
    revalidateAdmin();
    const name = user.name ?? user.email;
    return {
      ok: true,
      message:
        purpose === "RESET"
          ? msg(
              `New reset link for ${user.email}. Their current password keeps working until they use it.`,
              `สร้างลิงก์ตั้งรหัสผ่านใหม่ให้ ${user.email} แล้ว รหัสผ่านเดิมยังใช้ได้จนกว่าจะใช้ลิงก์`,
            )
          : msg(
              `New activation link for ${user.email}. Earlier links no longer work.`,
              `สร้างลิงก์เปิดใช้งานใหม่ให้ ${user.email} แล้ว ลิงก์ก่อนหน้าใช้ไม่ได้อีก`,
            ),
      link: {
        url: `${await appOrigin()}${link.path}`,
        expiresAt: link.expiresAt.toISOString(),
        purpose,
        loginId: user.email,
        name,
      },
    };
  });
}

export async function unlockAccount(
  input: z.input<typeof userOnlySchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = userOnlySchema.safeParse(input);
    if (!parsed.success) return fail("Unknown account.", "ไม่พบบัญชีผู้ใช้");
    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await recordActivity({
      viewer,
      action: "Unlocked account",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
    revalidateAdmin();
    return done(
      `${user.email} can try signing in again.`,
      `${user.email} ลองเข้าสู่ระบบได้อีกครั้งแล้ว`,
    );
  });
}

const renameSchema = z.object({ userId: idSchema, loginId: z.string().trim().min(3).max(120) });

/**
 * Correct a login id — a typo, a change of surname. The linked staff record's
 * work email follows, and sessions carry the account id, so nobody is signed out.
 */
export async function changeLoginId(
  input: z.input<typeof renameSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = renameSchema.safeParse(input);
    if (!parsed.success) return fail("Enter the new login id.", "กรุณากรอกไอดีเข้าสู่ระบบใหม่");
    const loginId = normaliseLoginId(parsed.data.loginId);
    if (!isValidLoginId(loginId)) {
      return fail(
        `The login id must look like name.sur@${LOGIN_DOMAIN}.`,
        `ไอดีเข้าสู่ระบบต้องอยู่ในรูปแบบ name.sur@${LOGIN_DOMAIN}`,
      );
    }
    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, employee: { select: { id: true } } },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (user.email === loginId) return done("That is already the login ID.", "ไอดีนี้ถูกใช้อยู่แล้ว");
    if (await loginIdClash(loginId, user.id, user.employee?.id)) {
      return fail(`${loginId} is already in use.`, `${loginId} ถูกใช้แล้ว`);
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { email: loginId } });
      if (user.employee) {
        await tx.employee.update({ where: { id: user.employee.id }, data: { email: loginId } });
      }
    });
    await recordActivity({
      viewer,
      action: "Changed login id",
      targetType: "user",
      targetId: user.id,
      targetLabel: loginId,
      detail: `${user.email} → ${loginId}`,
    });
    revalidateAdmin();
    return done(
      `The login id is now ${loginId}. Let the person know.`,
      `เปลี่ยนไอดีเข้าสู่ระบบเป็น ${loginId} แล้ว กรุณาแจ้งเจ้าของบัญชี`,
    );
  });
}

const linkSchema = z.object({ userId: idSchema, employeeId: idSchema });

/** Attach (or move) an account to a staff record. Status is left alone. */
export async function linkEmployee(
  input: z.input<typeof linkSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = linkSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Pick an employee to link.", "กรุณาเลือกพนักงานที่ต้องการเชื่อมบัญชี");
    }
    const { userId, employeeId } = parsed.data;

    const [user, employee] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, employee: { select: { id: true } } },
      }),
      db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, userId: true },
      }),
    ]);
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (!employee) {
      return fail("That employee no longer exists.", "ไม่พบข้อมูลพนักงานนี้แล้ว");
    }
    if (employee.userId && employee.userId !== user.id) {
      return fail(
        "That employee is already linked to another account.",
        "พนักงานคนนี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว",
      );
    }

    await db.$transaction(async (tx) => {
      // Employee.userId is unique, so a move drops the previous link first
      if (user.employee && user.employee.id !== employee.id) {
        await tx.employee.update({
          where: { id: user.employee.id },
          data: { userId: null },
        });
      }
      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: user.id },
      });
      await tx.user.update({ where: { id: user.id }, data: { name: employee.name } });
    });

    await recordActivity({
      viewer,
      action: "Linked employee",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: `Linked to ${employee.name}`,
    });
    revalidateAdmin();
    return done(
      `${user.email} is now linked to ${employee.name}.`,
      `เชื่อมบัญชี ${user.email} กับ ${employee.name} แล้ว`,
    );
  });
}

const roleSchema = z.object({ userId: idSchema, roleId: idSchema });

export async function setUserRole(
  input: z.input<typeof roleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return fail("Pick a role.", "กรุณาเลือกบทบาท");
    const { userId, roleId } = parsed.data;

    const [user, role] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
          role: {
            select: {
              id: true,
              nameEn: true,
              nameTh: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      }),
      db.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          nameEn: true,
          nameTh: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      }),
    ]);
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (!role) return fail("That role no longer exists.", "ไม่พบบทบาทนี้แล้ว");
    if (user.role?.id === role.id) {
      return done(
        `${user.email} already holds that role.`,
        `${user.email} มีบทบาทนี้อยู่แล้ว`,
      );
    }

    const next = new Set(role.permissions.map((p) => p.permission.key));
    const previous = new Set(user.role?.permissions.map((p) => p.permission.key) ?? []);

    // guard rail 1 — an admin may not hand their own account a role that cannot
    // administer roles or accounts: that is a one-way door out of this screen
    if (user.id === viewer.userId) {
      for (const key of [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS]) {
        if (!next.has(key)) {
          return fail(
            `"${role.nameEn}" does not include "${key}". You cannot take that permission away from your own account — ask another administrator.`,
            `บทบาท "${role.nameTh}" ไม่มีสิทธิ์ "${key}" คุณจึงไม่สามารถกำหนดบทบาทนี้ให้บัญชีของตนเองได้ กรุณาให้ผู้ดูแลระบบคนอื่นดำเนินการแทน`,
          );
        }
      }
    }

    // guard rail 2 — never move the last active holder of manage_roles off it
    if (
      user.status === "ACTIVE" &&
      previous.has(PERMISSIONS.MANAGE_ROLES) &&
      !next.has(PERMISSIONS.MANAGE_ROLES) &&
      !(await someoneElseStillHolds(PERMISSIONS.MANAGE_ROLES, { userId: user.id }))
    ) {
      return fail(
        "This is the last active account that can manage roles. Give another account that permission first.",
        "นี่เป็นบัญชีที่ใช้งานอยู่บัญชีสุดท้ายที่จัดการบทบาทได้ กรุณามอบสิทธิ์นี้ให้บัญชีอื่นก่อน",
      );
    }

    await db.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    await recordActivity({
      viewer,
      action: "Assigned role",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: `${user.role?.nameEn ?? "No role"} → ${role.nameEn}`,
    });
    revalidateAdmin();
    return done(
      `${user.email} is now ${role.nameEn}.`,
      `กำหนดบทบาท ${role.nameTh} ให้ ${user.email} แล้ว`,
    );
  });
}

const statusSchema = z.object({
  userId: idSchema,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function setUserStatus(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown status.", "สถานะไม่ถูกต้อง");
    const { userId, status } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        passwordSetAt: true,
        role: {
          select: { permissions: { select: { permission: { select: { key: true } } } } },
        },
      },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");

    // guard rail 3 — you cannot suspend yourself
    if (status === "SUSPENDED" && user.id === viewer.userId) {
      return fail(
        "You cannot suspend your own account. Another administrator has to do that.",
        "คุณไม่สามารถระงับบัญชีของตนเองได้ ต้องให้ผู้ดูแลระบบคนอื่นดำเนินการแทน",
      );
    }

    if (status === "SUSPENDED") {
      const holds = (user.role?.permissions ?? []).some(
        (p) => p.permission.key === PERMISSIONS.MANAGE_ROLES,
      );
      if (
        holds &&
        user.status === "ACTIVE" &&
        !(await someoneElseStillHolds(PERMISSIONS.MANAGE_ROLES, { userId: user.id }))
      ) {
        return fail(
          "This is the last active account that can manage roles. Suspending it would lock the system.",
          "นี่เป็นบัญชีสุดท้ายที่จัดการบทบาทได้ การระงับบัญชีนี้จะทำให้ไม่มีใครแก้ไขสิทธิ์ได้อีก",
        );
      }
    }

    // an account that never set a password goes back to waiting for activation
    const next =
      status === "ACTIVE" && !user.passwordSetAt ? ("PENDING" as const) : status;

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { status: next } });
      // a suspended account's outstanding links die with it
      if (next === "SUSPENDED") {
        await tx.accessToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
    });
    await recordActivity({
      viewer,
      action: status === "SUSPENDED" ? "Suspended account" : "Reactivated account",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: `${user.status} → ${next}`,
    });
    revalidateAdmin();
    if (next === "SUSPENDED") {
      return done(
        `${user.email} is suspended and signed out everywhere.`,
        `ระงับบัญชี ${user.email} แล้ว และออกจากระบบในทุกอุปกรณ์`,
      );
    }
    if (next === "PENDING") {
      return done(
        `${user.email} is back to awaiting activation — send them a new link.`,
        `${user.email} กลับไปเป็นสถานะรอเปิดใช้งาน กรุณาส่งลิงก์ใหม่ให้`,
      );
    }
    return done(
      `${user.email} is active again.`,
      `เปิดใช้งานบัญชี ${user.email} อีกครั้งแล้ว`,
    );
  });
}

const unlinkSchema = z.object({ userId: idSchema });

export async function unlinkUser(
  input: z.input<typeof unlinkSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_USERS, async (viewer) => {
    const parsed = unlinkSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown account.", "ไม่พบบัญชีผู้ใช้");

    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        email: true,
        employee: { select: { id: true, name: true } },
      },
    });
    if (!user) return fail("That account no longer exists.", "ไม่พบบัญชีผู้ใช้นี้แล้ว");
    if (!user.employee) {
      return fail(
        "That account is not linked to an employee.",
        "บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน",
      );
    }
    if (user.id === viewer.userId) {
      return fail(
        "You cannot detach your own staff record.",
        "คุณไม่สามารถยกเลิกการเชื่อมข้อมูลพนักงานของตนเองได้",
      );
    }

    // detach only — neither the login nor the staff record is deleted
    await db.employee.update({ where: { id: user.employee.id }, data: { userId: null } });

    await recordActivity({
      viewer,
      action: "Unlinked employee",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: `Detached from ${user.employee.name}`,
    });
    revalidateAdmin();
    return done(
      `${user.email} is no longer linked to ${user.employee.name}.`,
      `ยกเลิกการเชื่อมบัญชี ${user.email} กับ ${user.employee.name} แล้ว`,
    );
  });
}

/* ==========================================================================
   /admin/roles — roles and permissions
   ========================================================================== */

/** Catalogue order, so the matrix reads own → team → organisation → admin. */
const CATALOGUE_INDEX = new Map(
  PERMISSION_CATALOGUE.map((p, i) => [p.key as string, i] as const),
);
const SOURCE_BY_KEY = new Map(
  PERMISSION_CATALOGUE.map((p) => [p.key as string, p.source] as const),
);

export async function getRolesScreenData(): Promise<RolesScreenData> {
  const viewer = await assertPermission(PERMISSIONS.MANAGE_ROLES);

  const [roles, permissions, viewerUser] = await Promise.all([
    loadRoleSummaries(),
    db.permission.findMany({
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTh: true,
        category: true,
        descEn: true,
        descTh: true,
      },
    }),
    db.user.findUnique({ where: { id: viewer.userId }, select: { roleId: true } }),
  ]);

  const rows: PermissionRow[] = permissions
    .map((p) => ({ ...p, source: SOURCE_BY_KEY.get(p.key) ?? null }))
    .sort(
      (a, b) =>
        (CATALOGUE_INDEX.get(a.key) ?? 999) - (CATALOGUE_INDEX.get(b.key) ?? 999) ||
        a.key.localeCompare(b.key),
    );

  return { roles, permissions: rows, viewerRoleId: viewerUser?.roleId ?? null };
}

const togglePermissionSchema = z.object({
  roleId: idSchema,
  permissionId: idSchema,
  granted: z.boolean(),
});

/**
 * One cell of the matrix. Writes or deletes a RolePermission row immediately —
 * persisting the grant is the entire point of the screen, so it does not sit
 * behind a Save button waiting to be forgotten.
 */
export async function setRolePermission(
  input: z.input<typeof togglePermissionSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_ROLES, async (viewer) => {
    const parsed = togglePermissionSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Unknown role or permission.", "ไม่พบบทบาทหรือสิทธิ์ที่ระบุ");
    }
    const { roleId, permissionId, granted } = parsed.data;

    const [role, permission, viewerUser] = await Promise.all([
      db.role.findUnique({
        where: { id: roleId },
        select: { id: true, nameEn: true, nameTh: true },
      }),
      db.permission.findUnique({
        where: { id: permissionId },
        select: { id: true, key: true, nameEn: true, nameTh: true },
      }),
      db.user.findUnique({ where: { id: viewer.userId }, select: { roleId: true } }),
    ]);
    if (!role) return fail("That role no longer exists.", "ไม่พบบทบาทนี้แล้ว");
    if (!permission) return fail("That permission no longer exists.", "ไม่พบสิทธิ์นี้แล้ว");

    if (!granted) {
      const critical: string[] = [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS];

      // guard rail 4 — an admin cannot revoke account/role administration from
      // the very role their own session is standing on
      if (critical.includes(permission.key) && viewerUser?.roleId === role.id) {
        return fail(
          `"${permission.nameEn}" is what your own role uses to be on this screen. Removing it from "${role.nameEn}" would lock you out.`,
          `สิทธิ์ "${permission.nameTh}" คือสิทธิ์ที่บทบาทของคุณใช้เข้าถึงหน้านี้ การถอดออกจาก "${role.nameTh}" จะทำให้คุณเข้าใช้งานไม่ได้อีก`,
        );
      }

      // guard rail 5 — and never take the last copy in the system away
      if (
        critical.includes(permission.key) &&
        !(await someoneElseStillHolds(permission.key, { roleId: role.id }))
      ) {
        return fail(
          `No other active account would still have "${permission.nameEn}". Grant it to another role first.`,
          `จะไม่มีบัญชีที่ใช้งานอยู่รายใดเหลือสิทธิ์ "${permission.nameTh}" อีก กรุณามอบสิทธิ์นี้ให้บทบาทอื่นก่อน`,
        );
      }
    }

    if (granted) {
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    } else {
      await db.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: permission.id },
      });
    }

    await recordActivity({
      viewer,
      action: granted ? "Granted permission" : "Revoked permission",
      targetType: "role",
      targetId: role.id,
      targetLabel: role.nameEn,
      detail: `${permission.nameEn} (${permission.key})`,
    });
    revalidateAdmin();
    return granted
      ? done(
          `"${permission.nameEn}" granted to ${role.nameEn}.`,
          `เพิ่มสิทธิ์ "${permission.nameTh}" ให้บทบาท ${role.nameTh} แล้ว`,
        )
      : done(
          `"${permission.nameEn}" removed from ${role.nameEn}.`,
          `ถอดสิทธิ์ "${permission.nameTh}" ออกจากบทบาท ${role.nameTh} แล้ว`,
        );
  });
}

const createRoleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_-]*$/, "bad-key"),
  nameEn: z.string().trim().min(1).max(80),
  nameTh: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional().default(""),
});

export async function createRole(
  input: z.input<typeof createRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_ROLES, async (viewer) => {
    const parsed = createRoleSchema.safeParse(input);
    if (!parsed.success) {
      const badKey = parsed.error.issues.some((i) => i.message === "bad-key");
      return badKey
        ? fail(
            "The key must be lower-case letters, digits, - or _, starting with a letter.",
            "คีย์ต้องเป็นตัวพิมพ์เล็ก ตัวเลข - หรือ _ และขึ้นต้นด้วยตัวอักษร",
          )
        : fail(
            "Fill in the key and both names.",
            "กรุณากรอกคีย์และชื่อทั้งภาษาอังกฤษและภาษาไทย",
          );
    }
    const { key, nameEn, nameTh, description } = parsed.data;

    const clash = await db.role.findUnique({ where: { key }, select: { id: true } });
    if (clash) {
      return fail(`The key "${key}" is already taken.`, `คีย์ "${key}" ถูกใช้ไปแล้ว`);
    }

    const last = await db.role.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const role = await db.role.create({
      data: {
        key,
        nameEn,
        nameTh,
        description: description || null,
        isSystem: false,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      select: { id: true, nameEn: true },
    });

    await recordActivity({
      viewer,
      action: "Created role",
      targetType: "role",
      targetId: role.id,
      targetLabel: role.nameEn,
      detail: `key: ${key} — no permissions granted yet`,
    });
    revalidateAdmin();
    return done(
      `"${nameEn}" created. Give it permissions in the matrix below.`,
      `สร้างบทบาท "${nameTh}" แล้ว กำหนดสิทธิ์ได้ที่ตารางด้านล่าง`,
    );
  });
}

const updateRoleSchema = z.object({
  roleId: idSchema,
  nameEn: z.string().trim().min(1).max(80),
  nameTh: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional().default(""),
});

/** System roles can be renamed and described; their `key` is code and is not. */
export async function updateRole(
  input: z.input<typeof updateRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_ROLES, async (viewer) => {
    const parsed = updateRoleSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "Both names are required.",
        "ต้องระบุชื่อทั้งภาษาอังกฤษและภาษาไทย",
      );
    }
    const { roleId, nameEn, nameTh, description } = parsed.data;

    const role = await db.role.findUnique({
      where: { id: roleId },
      select: { id: true, nameEn: true },
    });
    if (!role) return fail("That role no longer exists.", "ไม่พบบทบาทนี้แล้ว");

    await db.role.update({
      where: { id: role.id },
      data: { nameEn, nameTh, description: description || null },
    });
    await recordActivity({
      viewer,
      action: "Edited role",
      targetType: "role",
      targetId: role.id,
      targetLabel: nameEn,
      detail:
        role.nameEn === nameEn ? "Updated details" : `Renamed from ${role.nameEn}`,
    });
    revalidateAdmin();
    return done(`"${nameEn}" updated.`, `อัปเดตบทบาท "${nameTh}" แล้ว`);
  });
}

const deleteRoleSchema = z.object({
  roleId: idSchema,
  /** where this role's users go — required whenever it has any */
  reassignToRoleId: z.string().max(64).optional().default(""),
});

export async function deleteRole(
  input: z.input<typeof deleteRoleSchema>,
): Promise<ActionResult> {
  return guarded(PERMISSIONS.MANAGE_ROLES, async (viewer) => {
    const parsed = deleteRoleSchema.safeParse(input);
    if (!parsed.success) return fail("Unknown role.", "ไม่พบบทบาทที่ระบุ");
    const { roleId, reassignToRoleId } = parsed.data;

    const [role, viewerUser] = await Promise.all([
      db.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          nameEn: true,
          nameTh: true,
          isSystem: true,
          _count: { select: { users: true } },
        },
      }),
      db.user.findUnique({ where: { id: viewer.userId }, select: { roleId: true } }),
    ]);
    if (!role) return fail("That role no longer exists.", "ไม่พบบทบาทนี้แล้ว");
    if (role.isSystem) {
      return fail(
        `"${role.nameEn}" is a system role. It can be edited but not deleted.`,
        `"${role.nameTh}" เป็นบทบาทของระบบ แก้ไขได้แต่ลบไม่ได้`,
      );
    }
    // guard rail 6 — deleting the role your own session is standing on
    if (viewerUser?.roleId === role.id) {
      return fail(
        "You cannot delete the role your own account holds.",
        "คุณไม่สามารถลบบทบาทที่บัญชีของคุณใช้อยู่ได้",
      );
    }

    let target: { id: string; nameEn: string; nameTh: string } | null = null;
    if (role._count.users > 0) {
      if (!reassignToRoleId) {
        return fail(
          `${role._count.users} account(s) hold this role. Choose the role they should move to.`,
          `มี ${role._count.users} บัญชีที่ใช้บทบาทนี้ กรุณาเลือกบทบาทปลายทางสำหรับบัญชีเหล่านี้`,
        );
      }
      if (reassignToRoleId === role.id) {
        return fail(
          "Pick a different role to move those accounts to.",
          "กรุณาเลือกบทบาทปลายทางที่ต่างจากบทบาทที่จะลบ",
        );
      }
      target = await db.role.findUnique({
        where: { id: reassignToRoleId },
        select: { id: true, nameEn: true, nameTh: true },
      });
      if (!target) {
        return fail(
          "That destination role no longer exists.",
          "ไม่พบบทบาทปลายทางนี้แล้ว",
        );
      }
    }

    const moved = role._count.users;
    const destination = target;
    await db.$transaction(async (tx) => {
      if (destination) {
        await tx.user.updateMany({
          where: { roleId: role.id },
          data: { roleId: destination.id },
        });
      }
      await tx.role.delete({ where: { id: role.id } });
    });

    await recordActivity({
      viewer,
      action: "Deleted role",
      targetType: "role",
      targetId: role.id,
      targetLabel: role.nameEn,
      detail: destination
        ? `${moved} account(s) moved to ${destination.nameEn}`
        : "No accounts held this role",
    });
    revalidateAdmin();
    return destination
      ? done(
          `"${role.nameEn}" deleted — ${moved} account(s) moved to "${destination.nameEn}".`,
          `ลบบทบาท "${role.nameTh}" แล้ว และย้าย ${moved} บัญชีไปยัง "${destination.nameTh}"`,
        )
      : done(`"${role.nameEn}" deleted.`, `ลบบทบาท "${role.nameTh}" แล้ว`);
  });
}

/* ==========================================================================
   /admin/audit — the trail
   ========================================================================== */

const auditQuerySchema = z.object({
  actorId: z.string().max(64).optional().default(""),
  action: z.string().max(120).optional().default(""),
  from: z.string().max(10).optional().default(""),
  to: z.string().max(10).optional().default(""),
  q: z.string().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(200).optional().default(25),
});

const EMPTY_AUDIT_FILTERS = {
  actorId: "",
  action: "",
  from: "",
  to: "",
  q: "",
  page: 1,
  pageSize: 25,
};

/** Filtering and paging happen in SQL; the browser never holds the whole table. */
function buildAuditWhere(f: {
  actorId: string;
  action: string;
  from: string;
  to: string;
  q: string;
}): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};
  if (f.actorId) where.actorId = f.actorId === "system" ? null : f.actorId;
  if (f.action) where.action = f.action;

  const range: { gte?: Date; lt?: Date } = {};
  const fromDate = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const toDate = f.to ? new Date(`${f.to}T00:00:00`) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) range.gte = fromDate;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    // an inclusive "to": everything before the following midnight
    range.lt = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
  }
  if (range.gte || range.lt) where.createdAt = range;

  const q = f.q.trim();
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actorLabel: { contains: q, mode: "insensitive" } },
      { targetLabel: { contains: q, mode: "insensitive" } },
      { detail: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function getActivityPage(
  input: z.input<typeof auditQuerySchema>,
): Promise<AuditPage> {
  await assertPermission(PERMISSIONS.VIEW_AUDIT_LOG);
  const parsed = auditQuerySchema.safeParse(input);
  const f = parsed.success ? parsed.data : EMPTY_AUDIT_FILTERS;

  const where = buildAuditWhere(f);

  const [total, totalUnfiltered, actorGroups, actionGroups] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.count(),
    db.activityLog.groupBy({
      by: ["actorId", "actorLabel"],
      orderBy: { actorLabel: "asc" },
    }),
    db.activityLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / f.pageSize));
  const page = Math.min(f.page, pageCount);

  const rows = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * f.pageSize,
    take: f.pageSize,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      actorLabel: true,
      action: true,
      targetType: true,
      targetLabel: true,
      detail: true,
    },
  });

  // one option per actor, the actor-less "system" rows folded into one
  const actors = new Map<string, string>();
  for (const g of actorGroups) {
    actors.set(g.actorId ?? "system", g.actorLabel || "system");
  }

  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    totalUnfiltered,
    page,
    pageSize: f.pageSize,
    pageCount,
    actors: [...actors].map(([id, label]) => ({ id, label })),
    actions: actionGroups.map((g) => g.action),
  };
}

function csvCell(value: string | null | undefined) {
  const s = String(value ?? "");
  return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_LIMIT = 5000;

/**
 * CSV of the *filtered* set, built from the same where clause as the table — so
 * it exports what the filters describe, not the 25 rows of the current page.
 */
export async function exportActivityCsv(
  input: z.input<typeof auditQuerySchema>,
): Promise<{ ok: true; csv: string; rows: number } | { ok: false; error: Bilingual }> {
  try {
    await assertPermission(PERMISSIONS.VIEW_AUDIT_LOG);
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return { ok: false, error: msg(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้") };
    }
    throw err;
  }
  const parsed = auditQuerySchema.safeParse(input);
  const f = parsed.success ? parsed.data : EMPTY_AUDIT_FILTERS;

  const rows = await db.activityLog.findMany({
    where: buildAuditWhere(f),
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    select: {
      createdAt: true,
      actorId: true,
      actorLabel: true,
      action: true,
      targetType: true,
      targetLabel: true,
      detail: true,
    },
  });

  const header = [
    "timestamp",
    "actor_id",
    "actor",
    "action",
    "target_type",
    "target",
    "detail",
  ];
  const body = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.actorId ?? "system",
      r.actorLabel,
      r.action,
      r.targetType,
      r.targetLabel,
      r.detail,
    ]
      .map(csvCell)
      .join(","),
  );

  return { ok: true, csv: [header.join(","), ...body].join("\r\n"), rows: rows.length };
}
