import { redirect } from "next/navigation";

/** Managing announcements moved into the Announcements page itself. */
export default function ManageAnnouncementPage() {
  redirect("/announcements");
}
