import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getEmployeeAdminData } from "@/server/admin-content";
import {
  EmployeeAdminScreen,
  type EmployeeTabKey,
} from "@/components/admin/EmployeeAdminScreen";

export const metadata: Metadata = { title: "Staff records" };

export const dynamic = "force-dynamic";

const TABS: EmployeeTabKey[] = ["employees", "position", "role", "department", "division"];

export default async function ManageEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const { tab } = await searchParams;
  // accounts were a tab here for a while; keep those links working
  if (tab === "accounts") redirect("/admin/employee/accounts");
  const data = await getEmployeeAdminData();
  const initialTab = TABS.includes(tab as EmployeeTabKey) ? (tab as EmployeeTabKey) : "employees";
  return <EmployeeAdminScreen data={data} initialTab={initialTab} />;
}
