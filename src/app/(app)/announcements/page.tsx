import type { Metadata } from "next";
import { can, PERMISSIONS } from "@/lib/permissions";
import { requireViewer } from "@/server/session";
import {
  getAudienceOptions,
  listAnnouncementsForAdmin,
  listMyAnnouncements,
  listNotificationRules,
} from "@/server/announcements";
import { AnnouncementFeed } from "@/components/announcements/AnnouncementFeed";
import { AnnouncementsHeading } from "@/components/announcements/AnnouncementsHeading";
import { AnnouncementAdmin } from "@/components/announcements/AnnouncementAdmin";
import { AnnouncementsFrame } from "@/components/announcements/AnnouncementsFrame";

export const metadata: Metadata = { title: "Announcements · 1Moby" };

/**
 * The company noticeboard, and — for anyone whose role can send
 * announcements — where they are written too. Reading needs no permission, but
 * the feed query only ever returns what is addressed to this person. The
 * Manage tab is decided by `send_announcements`, and every action behind it
 * checks that permission again on the server.
 */
export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; view?: string }>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const canManage = can(viewer.permissions, PERMISSIONS.SEND_ANNOUNCEMENTS);

  if (!canManage) {
    const feed = await listMyAnnouncements({ filter, q: query });
    return (
      <div className="mx-auto max-w-[900px] p-6 lg:p-10">
        <AnnouncementsHeading unreadCount={feed.unreadCount} totalCount={feed.totalCount} />
        <AnnouncementFeed feed={feed} filter={filter} query={query} />
      </div>
    );
  }

  // senders land on Manage; the feed is one tab away
  if (params.view === "feed") {
    const feed = await listMyAnnouncements({ filter, q: query });
    return (
      <AnnouncementsFrame view="feed" unreadCount={feed.unreadCount}>
        <div className="max-w-[900px]">
          <AnnouncementFeed feed={feed} filter={filter} query={query} keepView />
        </div>
      </AnnouncementsFrame>
    );
  }

  const [rows, options, rules, feed] = await Promise.all([
    listAnnouncementsForAdmin(),
    getAudienceOptions(),
    listNotificationRules(),
    listMyAnnouncements({ filter: "all", q: "" }),
  ]);
  return (
    <AnnouncementsFrame view="manage" unreadCount={feed.unreadCount}>
      <AnnouncementAdmin rows={rows} options={options} rules={rules} embedded />
    </AnnouncementsFrame>
  );
}
