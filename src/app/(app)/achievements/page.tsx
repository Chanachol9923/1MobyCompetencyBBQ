import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requireEmployee, requirePermission } from "@/server/session";
import { getAchievementsScreenData } from "@/server/engagement";
import { AchievementsScreen } from "./AchievementsScreen";

export const metadata: Metadata = { title: "Achievements" };

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  await requireEmployee();
  await requirePermission(PERMISSIONS.REDEEM_REWARDS);
  const data = await getAchievementsScreenData();
  return <AchievementsScreen data={data} />;
}
