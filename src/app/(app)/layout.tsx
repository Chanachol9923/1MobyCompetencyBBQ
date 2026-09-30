import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireViewer } from "@/server/session";
import { ViewerProvider, type ClientViewer } from "@/lib/viewer";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Server layout: it resolves who is signed in once per request and hands the
 * result down. Every page below can trust `useViewer()` because the server
 * already checked it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();

  // An account with no staff record and no permissions has nothing to open —
  // not an error, HROD has a step left (see /pending).
  const usable = viewer.employeeId !== null || viewer.permissions.length > 0;
  if (viewer.status !== "ACTIVE" || !usable) redirect("/pending");

  const [role, employee] = await Promise.all([
    viewer.roleKey
      ? db.role.findUnique({
          where: { key: viewer.roleKey },
          select: { nameEn: true },
        })
      : null,
    viewer.employeeId
      ? db.employee.findUnique({
          where: { id: viewer.employeeId },
          select: { jobRole: { select: { name: true, level: true } } },
        })
      : null,
  ]);

  const clientViewer: ClientViewer = {
    userId: viewer.userId,
    email: viewer.email,
    name: viewer.name,
    image: viewer.image,
    status: viewer.status,
    roleKey: viewer.roleKey,
    roleName: role?.nameEn ?? null,
    permissions: viewer.permissions,
    employeeId: viewer.employeeId,
    employeeName: viewer.employeeName,
    jobRoleName: employee?.jobRole.name ?? null,
    level: employee?.jobRole.level ?? null,
    reportCount: viewer.reportIds.length,
  };

  return (
    <ViewerProvider viewer={clientViewer}>
      <AppShell>{children}</AppShell>
    </ViewerProvider>
  );
}
