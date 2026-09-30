import "server-only";
import { db } from "@/lib/db";
import type { DemoAccount } from "@/app/login/LoginForm";

/**
 * Test-mode suggestions under the Login ID field. Read from the database rather
 * than hard-coded, so they are always accounts that actually exist: one
 * individual contributor, one manager with reports, and the administrator.
 */
export async function loadTestAccounts(): Promise<DemoAccount[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "true") return [];

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
