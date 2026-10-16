"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHeading, Tabs } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { SmoothPanel } from "@/components/ui/SmoothPanel";

export type AnnouncementsView = "manage" | "feed";

/**
 * One Announcements page for people who also send them: managing and reading
 * sit behind two tabs instead of two menu items. The tab lives in the URL, so
 * a reload or a shared link lands on the same one.
 */
export function AnnouncementsFrame({
  view: initialView,
  unreadCount,
  manage,
  feed,
}: {
  view: AnnouncementsView;
  unreadCount: number;
  manage: ReactNode;
  feed: ReactNode;
}) {
  const { tt } = useT();
  // both panels are on the page; switching is instant and neither loses what
  // was typed into it, while the URL keeps the tab for a refresh or a link
  const [view, setView] = useState(initialView);
  useEffect(() => setView(initialView), [initialView]);

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
          onChange={(next) => {
            setView(next);
            window.history.replaceState(null, "", next === "manage" ? "/announcements" : "/announcements?view=feed");
          }}
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
      <SmoothPanel swapKey={view}>
        <div hidden={view !== "manage"}>{manage}</div>
        <div hidden={view !== "feed"} className="max-w-[900px]">
          {feed}
        </div>
      </SmoothPanel>
    </div>
  );
}
