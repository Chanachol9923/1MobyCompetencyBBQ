import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signInOptions } from "@/lib/auth";
import { LOGIN_DOMAIN } from "@/lib/login-id";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";
import { LoginForm, type DemoAccount } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Demo personas are read from the database rather than hard-coded, so the login
 * screen only ever offers accounts that actually exist: one individual
 * contributor, one manager with reports, and the administrator.
 */
async function loadDemoAccounts(): Promise<DemoAccount[]> {
  if (!signInOptions.demo) return [];

  const active = { status: "ACTIVE" as const };
  const [ic, manager, admin] = await Promise.all([
    db.employee.findFirst({
      where: { reports: { none: {} }, jobRole: { name: "Executive" }, user: active },
      orderBy: { name: "asc" },
      select: { name: true, email: true, jobRole: { select: { name: true, level: true } } },
    }),
    db.employee.findFirst({
      where: { reports: { some: {} }, user: active },
      orderBy: { name: "asc" },
      select: {
        name: true,
        email: true,
        jobRole: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }),
    db.user.findFirst({
      where: { role: { key: "admin" }, employee: null, ...active },
      orderBy: { createdAt: "asc" },
      select: { email: true, name: true },
    }),
  ]);

  const out: DemoAccount[] = [];
  if (ic) {
    out.push({
      loginId: ic.email,
      name: ic.name,
      roleLabel: "Employee",
      detail: `${ic.jobRole.name} · ${ic.jobRole.level}`,
    });
  }
  if (manager) {
    out.push({
      loginId: manager.email,
      name: manager.name,
      roleLabel: "Manager",
      detail: `${manager.jobRole.name} · ${manager._count.reports} direct reports`,
    });
  }
  if (admin) {
    out.push({
      loginId: admin.email,
      name: admin.name ?? admin.email,
      roleLabel: "Administrator",
      detail: "HROD — runs the framework",
    });
  }
  return out;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string; notice?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer && viewer.status === "ACTIVE") {
    redirect(homeFor(viewer));
  }

  const params = await searchParams;
  const demoAccounts = await loadDemoAccounts();
  const notice =
    params.notice === "activated" || params.notice === "password_changed"
      ? params.notice
      : undefined;

  return (
    <LoginForm
      loginDomain={LOGIN_DOMAIN}
      demoAccounts={demoAccounts}
      ssoName={signInOptions.sso}
      error={viewer?.status === "SUSPENDED" ? "suspended" : params.error}
      code={params.code}
      next={params.next}
      notice={notice}
    />
  );
}
