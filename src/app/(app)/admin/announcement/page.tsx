import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import {
  getAudienceOptions,
  listAnnouncementsForAdmin,
  listNotificationRules,
} from "@/server/announcements";
import { AnnouncementAdmin } from "@/components/announcements/AnnouncementAdmin";

export const metadata: Metadata = { title: "Announcement Management · 1Moby" };

/**
 * Server half of the admin screen: the guard, and the three reads the composer
 * needs. The page bounces anyone without `send_announcements`; the actions the
 * client calls check the same permission again, because a page guard cannot
 * protect a mutation.
 */
export default async function ManageAnnouncementPage() {
  await requirePermission(PERMISSIONS.SEND_ANNOUNCEMENTS);

  const [rows, options, rules] = await Promise.all([
    listAnnouncementsForAdmin(),
    getAudienceOptions(),
    listNotificationRules(),
  ]);

  return <AnnouncementAdmin rows={rows} options={options} rules={rules} />;
}
