import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getLmsAdminData } from "@/server/admin-content";
import { LmsAdminScreen } from "@/components/admin/LmsAdminScreen";

export const metadata: Metadata = { title: "Manage LMS" };

export const dynamic = "force-dynamic";

export default async function ManageLmsPage() {
  await requirePermission(PERMISSIONS.MANAGE_LMS);
  const data = await getLmsAdminData();
  return <LmsAdminScreen data={data} />;
}
