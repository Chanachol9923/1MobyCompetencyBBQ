"use client";

import { PageHeading } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** The page title, client-side only because the language lives in the browser. */
export function AnnouncementsHeading({
  unreadCount,
  totalCount,
}: {
  unreadCount: number;
  totalCount: number;
}) {
  const { tt } = useT();
  return (
    <PageHeading
      title={tt("Announcements", "ประกาศ")}
      subtitle={
        totalCount === 0
          ? tt("Nothing has been published yet.", "ยังไม่มีประกาศที่เผยแพร่")
          : unreadCount > 0
            ? tt(
                `${unreadCount} unread of ${totalCount} addressed to you`,
                `ยังไม่ได้อ่าน ${unreadCount} จาก ${totalCount} ประกาศที่ส่งถึงคุณ`,
              )
            : tt(
                `All ${totalCount} read`,
                `อ่านครบทั้ง ${totalCount} ประกาศแล้ว`,
              )
      }
    />
  );
}
