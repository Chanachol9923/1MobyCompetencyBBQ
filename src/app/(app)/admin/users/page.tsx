import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getUsersScreenData } from "@/server/admin-users";
import { UsersScreen } from "@/components/admin/UsersScreen";

export const metadata: Metadata = { title: "Accounts" };

// account state changes under our feet, so never serve this from a static cache
export const dynamic = "force-dynamic";

/**
 * The page guard redirects (the house rule for pages); the actions the screen
 * calls each assert `manage_users` again for themselves, because a redirect is
 * a courtesy and only the action is a gate.
 */
export default async function AdminUsersPage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS);
  const data = await getUsersScreenData();
  return <UsersScreen data={data} />;
}
