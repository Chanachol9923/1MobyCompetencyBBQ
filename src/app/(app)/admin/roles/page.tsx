import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getRolesScreenData } from "@/server/admin-users";
import { RolesScreen } from "@/components/admin/RolesScreen";

export const metadata: Metadata = { title: "Roles & permissions" };

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.MANAGE_ROLES);
  const data = await getRolesScreenData();
  return <RolesScreen data={data} />;
}
