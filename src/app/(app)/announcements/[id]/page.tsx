import { notFound } from "next/navigation";
import { requireViewer } from "@/server/session";
import { getMyAnnouncement } from "@/server/announcements";
import { AnnouncementReader } from "@/components/announcements/AnnouncementReader";

/**
 * A linkable announcement, because every notification deep-links here.
 *
 * The id comes from the URL, so it is resolved through the same audience
 * filter the feed uses: an announcement that was not addressed to this viewer
 * is a 404, not a redacted page.
 */
export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireViewer();
  const { id } = await params;
  const announcement = await getMyAnnouncement(id);
  if (!announcement) notFound();

  return <AnnouncementReader announcement={announcement} />;
}
