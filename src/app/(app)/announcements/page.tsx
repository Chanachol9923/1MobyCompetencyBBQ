import type { Metadata } from "next";
import { requireViewer } from "@/server/session";
import { listMyAnnouncements } from "@/server/announcements";
import { AnnouncementFeed } from "@/components/announcements/AnnouncementFeed";
import { AnnouncementsHeading } from "@/components/announcements/AnnouncementsHeading";

export const metadata: Metadata = { title: "Announcements · 1Moby" };

/**
 * The company noticeboard. Everyone who is signed in can read it — there is no
 * permission for "receive an announcement" — but the query only ever returns
 * the ones addressed to this person.
 */
export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireViewer();
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";

  const feed = await listMyAnnouncements({ filter, q: query });

  return (
    <div className="mx-auto max-w-[900px] p-6 lg:p-10">
      <AnnouncementsHeading unreadCount={feed.unreadCount} totalCount={feed.totalCount} />
      <AnnouncementFeed feed={feed} filter={filter} query={query} />
    </div>
  );
}
