import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getEmployeeAdminData } from "@/server/admin-content";
import { getUsersScreenData } from "@/server/admin-users";
import {
  EmployeeAdminScreen,
  type EmployeeTabKey,
} from "@/components/admin/EmployeeAdminScreen";

export const metadata: Metadata = { title: "Manage Employee" };

export const dynamic = "force-dynamic";

const TABS: EmployeeTabKey[] = [
  "employees",
  "accounts",
  "position",
  "role",
  "department",
  "division",
  "permissions",
];

/**
 * Staff records and their login accounts on one screen: both need
 * `manage_users`, and creating a person is usually followed by creating their
 * account. Both reads run together; switching tab costs no round trip.
 */
export default async function ManageEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const { tab } = await searchParams;
  const [data, accounts] = await Promise.all([getEmployeeAdminData(), getUsersScreenData()]);
  const initialTab = TABS.includes(tab as EmployeeTabKey) ? (tab as EmployeeTabKey) : "employees";
  return <EmployeeAdminScreen data={data} accounts={accounts} initialTab={initialTab} />;
}
