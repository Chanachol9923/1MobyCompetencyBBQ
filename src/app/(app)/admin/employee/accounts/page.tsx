import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getUsersScreenData } from "@/server/admin-users";
import { UsersScreen } from "@/components/admin/UsersScreen";

export const metadata: Metadata = { title: "Accounts" };

// account state changes under our feet, so never serve this from a static cache
export const dynamic = "force-dynamic";

/**
 * Login accounts, listed under Employee in the menu because every account is
 * linked to a staff record there. The page guard redirects; every action the
 * screen calls asserts `manage_users` again for itself.
 */
export default async function AccountsPage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const data = await getUsersScreenData();
  return <UsersScreen data={data} />;
}
