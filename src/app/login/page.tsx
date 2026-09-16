import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";
import { LoginForm, type DemoAccount } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Demo personas are read from the database rather than hard-coded, so the login
 * screen always offers accounts that actually exist: one individual contributor,
 * one manager with reports, and the administrator.
 */
async function loadDemoAccounts(): Promise<DemoAccount[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "true") return [];

  const [ic, manager, admin] = await Promise.all([
    db.employee.findFirst({
      where: { reports: { none: {} }, jobRole: { name: "Executive" } },
      orderBy: { name: "asc" },
      select: {
        employeeCode: true,
        name: true,
        jobRole: { select: { name: true, level: true } },
      },
    }),
    db.employee.findFirst({
      where: { reports: { some: {} } },
      orderBy: { name: "asc" },
      select: {
        employeeCode: true,
        name: true,
        jobRole: { select: { name: true, level: true } },
        _count: { select: { reports: true } },
      },
    }),
    db.user.findFirst({
      where: { role: { key: "admin" }, employee: null, status: "ACTIVE" },
      select: { email: true, name: true },
    }),
  ]);

  const out: DemoAccount[] = [];
  if (ic) {
    out.push({
      key: ic.employeeCode,
      name: ic.name,
      roleLabel: ic.jobRole.name,
      detail: ic.jobRole.level,
    });
  }
  if (manager) {
    out.push({
      key: manager.employeeCode,
      name: manager.name,
      roleLabel: manager.jobRole.name,
      detail: `${manager._count.reports} direct reports`,
    });
  }
  if (admin) {
    out.push({
      key: admin.email,
      name: admin.name ?? admin.email,
      roleLabel: "Administrator",
      detail: "runs the framework",
    });
  }
  return out;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer && viewer.status === "ACTIVE") {
    redirect(homeFor(viewer));
  }

  const params = await searchParams;
  const demoAccounts = await loadDemoAccounts();

  return (
    <LoginForm
      demoAccounts={demoAccounts}
      googleEnabled={Boolean(process.env.AUTH_GOOGLE_ID)}
      error={params.error}
      next={params.next}
    />
  );
}
