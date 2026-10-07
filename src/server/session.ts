import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type PermissionKey } from "@/lib/permissions";

/**
 * Authorisation lives here, next to the data, because that is the only place it
 * cannot be bypassed. Middleware answers "signed in?"; everything below answers
 * "allowed to see or change *this*?".
 */

export type Viewer = {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  roleKey: string | null;
  roleName: string | null;
  roleNameTh: string | null;
  permissions: string[];
  /** null for an account with no staff record, such as the HROD administrator */
  employeeId: string | null;
  employeeName: string | null;
  jobRoleName: string | null;
  /** career level of the job role, e.g. "Level 3: Supervise" */
  level: string | null;
  /** ids this viewer directly manages */
  reportIds: string[];
  /** set while an administrator's request to set a new password is open */
  resetPendingUntil: string | null;
};

/** Cached per request, so ten components asking costs one query. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      status: true,
      passwordSetAt: true,
      accessTokens: {
        where: { purpose: "RESET", usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
      role: {
        select: {
          key: true,
          nameEn: true,
          nameTh: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      employee: {
        select: {
          id: true,
          name: true,
          jobRole: { select: { name: true, level: true } },
          reports: { select: { id: true } },
        },
      },
    },
  });
  if (!user) return null;

  // A password set after this session opened — the person reset it, or an
  // administrator's reset link was used — retires every older session.
  if (
    user.passwordSetAt &&
    session.user.authAt &&
    user.passwordSetAt.getTime() > session.user.authAt + 1000
  ) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.employee?.name ?? user.name ?? user.email,
    image: user.image,
    status: user.status,
    roleKey: user.role?.key ?? null,
    roleName: user.role?.nameEn ?? null,
    roleNameTh: user.role?.nameTh ?? null,
    permissions: user.role?.permissions.map((p) => p.permission.key) ?? [],
    employeeId: user.employee?.id ?? null,
    employeeName: user.employee?.name ?? null,
    jobRoleName: user.employee?.jobRole.name ?? null,
    level: user.employee?.jobRole.level ?? null,
    reportIds: user.employee?.reports.map((r) => r.id) ?? [],
    resetPendingUntil: user.accessTokens[0]?.expiresAt.toISOString() ?? null,
  };
});

/** For pages. Sends anyone without a session to the login screen. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.status === "SUSPENDED") redirect("/login?error=suspended");
  return viewer;
}

/** A viewer who has been linked to a staff record and can use the product. */
export async function requireEmployee(): Promise<Viewer & { employeeId: string }> {
  const viewer = await requireViewer();
  if (!viewer.employeeId || viewer.status !== "ACTIVE") redirect("/pending");
  return viewer as Viewer & { employeeId: string };
}

export async function requirePermission(
  key: PermissionKey,
): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!can(viewer.permissions, key)) redirect("/forbidden");
  return viewer;
}

/* --------------------------------------------------------- action guards */

export class NotAuthorised extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "NotAuthorised";
  }
}

/**
 * For server actions, which must throw rather than redirect so the caller can
 * show the error in place.
 */
export async function assertViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new NotAuthorised("You are not signed in.");
  if (viewer.status === "SUSPENDED") throw new NotAuthorised("Your account is suspended.");
  return viewer;
}

export async function assertPermission(key: PermissionKey): Promise<Viewer> {
  const viewer = await assertViewer();
  if (!can(viewer.permissions, key)) throw new NotAuthorised();
  return viewer;
}

export async function assertEmployee(): Promise<Viewer & { employeeId: string }> {
  const viewer = await assertViewer();
  if (!viewer.employeeId) {
    throw new NotAuthorised("Your account is not linked to an employee record yet.");
  }
  return viewer as Viewer & { employeeId: string };
}

/**
 * Whether this viewer may look at a particular person's result.
 * Own record, a direct report, or a company-wide permission.
 */
export function canSeeEmployee(viewer: Viewer, employeeId: string): boolean {
  if (viewer.employeeId === employeeId) return true;
  if (can(viewer.permissions, "see_company_report")) return true;
  if (can(viewer.permissions, "see_team_result") && viewer.reportIds.includes(employeeId)) {
    return true;
  }
  return false;
}

export async function assertCanSeeEmployee(employeeId: string): Promise<Viewer> {
  const viewer = await assertViewer();
  if (!canSeeEmployee(viewer, employeeId)) throw new NotAuthorised();
  return viewer;
}

/** Only the person's own manager may review or set goals for them. */
export async function assertManagerOf(employeeId: string): Promise<Viewer> {
  const viewer = await assertViewer();
  if (!viewer.reportIds.includes(employeeId)) {
    throw new NotAuthorised("Only this person's manager can do that.");
  }
  return viewer;
}

/* ------------------------------------------------------------ audit trail */

export async function recordActivity(input: {
  viewer: Viewer | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  detail?: string;
}) {
  await db.activityLog.create({
    data: {
      actorId: input.viewer?.userId ?? null,
      actorLabel: input.viewer?.name ?? "system",
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      detail: input.detail ?? null,
    },
  });
}
