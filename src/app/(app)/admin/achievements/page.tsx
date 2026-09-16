import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getBadgeAdminData } from "@/server/admin-content";
import { BadgeAdminScreen } from "@/components/admin/BadgeAdminScreen";

export const metadata: Metadata = { title: "Achievements Management" };

export const dynamic = "force-dynamic";

export default async function ManageAchievementsPage() {
  await requirePermission(PERMISSIONS.MANAGE_REWARDS);
  const data = await getBadgeAdminData();
  return <BadgeAdminScreen data={data} />;
}
