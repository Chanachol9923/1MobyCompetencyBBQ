import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requireEmployee, requirePermission } from "@/server/session";
import { getRewardScreenData } from "@/server/engagement";
import { RewardScreen } from "./RewardScreen";

export const metadata: Metadata = { title: "Reward" };

// points and stock move under our feet, so never serve this from a static cache
export const dynamic = "force-dynamic";

/**
 * The page guard redirects, which is the house rule for pages. The redeem
 * action asserts the same permission again for itself, because a redirect is a
 * courtesy and only the action is a gate.
 */
export default async function RewardPage() {
  await requireEmployee();
  await requirePermission(PERMISSIONS.REDEEM_REWARDS);
  const data = await getRewardScreenData();
  return <RewardScreen data={data} />;
}
