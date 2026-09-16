import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getAdminOverviewData } from "@/server/admin-content";
import { AdminOverviewScreen } from "@/components/admin/AdminOverviewScreen";

export const metadata: Metadata = { title: "Admin Overview" };

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const data = await getAdminOverviewData();
  return <AdminOverviewScreen data={data} />;
}

