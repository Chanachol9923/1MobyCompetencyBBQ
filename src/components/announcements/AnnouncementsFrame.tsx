"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageHeading, Tabs } from "@/components/ui";
import { useT } from "@/lib/i18n";

export type AnnouncementsView = "manage" | "feed";

/**
 * One Announcements page for people who also send them: managing and reading
 * sit behind two tabs instead of two menu items. The tab lives in the URL, so
 * a reload or a shared link lands on the same one.
 */
export function AnnouncementsFrame({
  view,
  unreadCount,
  children,
}: {
  view: AnnouncementsView;
  unreadCount: number;
  children: ReactNode;
}) {
  const { tt } = useT();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Announcements", "ประกาศ")}
        subtitle={
          view === "manage"
            ? tt(
                "Write, schedule and publish. Published announcements reach every recipient's feed with a notification.",
                "เขียน ตั้งเวลา และเผยแพร่ประกาศ ประกาศที่เผยแพร่จะแสดงในฟีดของผู้รับพร้อมการแจ้งเตือน",
              )
            : tt(
                "What has been sent to you, as your staff see it.",
                "ประกาศที่ส่งถึงคุณ ในมุมเดียวกับที่พนักงานเห็น",
              )
        }
      />
      <div className="scroll-thin -mx-1 mb-5 overflow-x-auto px-1">
        <Tabs
          value={view}
          onChange={(next) =>
            router.push(next === "manage" ? "/announcements" : "/announcements?view=feed")
          }
          options={[
            { value: "manage", label: tt("Manage", "จัดการ") },
            {
              value: "feed",
              label:
                unreadCount > 0
                  ? tt(`Feed (${unreadCount} unread)`, `ฟีด (ยังไม่อ่าน ${unreadCount})`)
                  : tt("Feed", "ฟีด"),
            },
          ]}
          className="min-w-max"
        />
      </div>
      {children}
    </div>
  );
}
