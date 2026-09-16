import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getRewardAdminData } from "@/server/admin-content";
import { RewardAdminScreen } from "@/components/admin/RewardAdminScreen";

export const metadata: Metadata = { title: "Rewards Management" };

export const dynamic = "force-dynamic";

export default async function ManageRewardPage() {
  await requirePermission(PERMISSIONS.MANAGE_REWARDS);
  const data = await getRewardAdminData();
  return <RewardAdminScreen data={data} />;
}
