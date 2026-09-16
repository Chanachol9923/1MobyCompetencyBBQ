import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getEmployeeAdminData } from "@/server/admin-content";
import { EmployeeAdminScreen } from "@/components/admin/EmployeeAdminScreen";

export const metadata: Metadata = { title: "Manage Employee" };

export const dynamic = "force-dynamic";

export default async function ManageEmployeePage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const data = await getEmployeeAdminData();
  return <EmployeeAdminScreen data={data} />;
}
