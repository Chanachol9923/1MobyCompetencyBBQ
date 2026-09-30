import { redirect } from "next/navigation";
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

  const clientViewer: ClientViewer = {
    userId: viewer.userId,
    email: viewer.email,
    name: viewer.name,
    image: viewer.image,
    status: viewer.status,
    roleKey: viewer.roleKey,
    roleName: viewer.roleName,
    permissions: viewer.permissions,
    employeeId: viewer.employeeId,
    employeeName: viewer.employeeName,
    jobRoleName: viewer.jobRoleName,
    level: viewer.level,
    reportCount: viewer.reportIds.length,
  };

  return (
    <ViewerProvider viewer={clientViewer}>
      <AppShell>{children}</AppShell>
    </ViewerProvider>
  );
}
