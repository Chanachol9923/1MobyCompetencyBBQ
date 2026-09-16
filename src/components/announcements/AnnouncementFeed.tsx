"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Megaphone, Pin, Users } from "lucide-react";
import { Card, EmptyState, Pill, Tabs } from "@/components/ui";
import { SearchInput } from "@/components/admin/shared";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AnnouncementFeed as Feed } from "./types";
import { audienceLabel, channelLabel, excerpt, formatWhen, pick } from "./format";

/**
 * What every signed-in person sees at /announcements.
 *
 * The rows arrive already narrowed to this viewer's audience — the filter and
 * the search box re-run the query on the server through the URL rather than
 * hiding rows that were sent to the browser anyway.
 */
export function AnnouncementFeed({
  feed,
  filter,
  query,
}: {
  feed: Feed;
  filter: "all" | "unread";
  query: string;
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(query);
  const typed = useRef(false);

  // keep the box in step when the URL changes underneath us (back button)
  useEffect(() => {
    if (!typed.current) setDraftQuery(query);
  }, [query]);

  const go = (next: { filter?: "all" | "unread"; q?: string }) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const q = next.q ?? draftQuery;
    if (f !== "all") params.set("filter", f);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.replace(qs ? `/announcements?${qs}` : "/announcements");
  };

  // debounce the search so a keystroke is not a query
  useEffect(() => {
    if (!typed.current) return;
    const id = window.setTimeout(() => go({ q: draftQuery }), 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  const nothingAtAll = feed.totalCount === 0;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={filter}
            onChange={(v) => {
              typed.current = false;
              go({ filter: v });
            }}
            options={[
              { value: "all" as const, label: t("label.all") },
              {
                value: "unread" as const,
                label: `${tt("Unread", "ยังไม่ได้อ่าน")}${
                  feed.unreadCount ? ` (${feed.unreadCount})` : ""
                }`,
              },
            ]}
          />
          <SearchInput
            className="w-full sm:w-72"
            value={draftQuery}
            onChange={(v) => {
              typed.current = true;
              setDraftQuery(v);
            }}
            placeholder={tt("Search announcements...", "ค้นหาประกาศ...")}
          />
        </div>
      </Card>

      <div className="mt-5 space-y-3">
        {feed.items.map((a) => {
          const title = pick(lang, a.titleEn, a.titleTh);
          const body = pick(lang, a.bodyEn, a.bodyTh);
          return (
            <Link key={a.id} href={`/announcements/${a.id}`} className="block">
              <Card
                interactive
                className={cn(
                  "flex gap-4 p-5",
                  !a.read && "border-brand/40 bg-brand-tint/20",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    a.read ? "bg-surface text-muted" : "bg-brand-tint text-brand",
                  )}
                >
                  <Megaphone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-ink">
                      {a.pinned ? (
                        <Pin
                          size={13}
                          className="mr-1 inline -translate-y-px text-amber"
                          aria-label={tt("Pinned", "ปักหมุด")}
                        />
                      ) : null}
                      {title}
                    </p>
                    {!a.read ? (
                      <span className="mt-1 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-brand">
                        <span className="size-2 rounded-full bg-brand" aria-hidden />
                        {tt("New", "ใหม่")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {excerpt(body)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone="brand">
                      <Users size={11} className="mr-1" />
                      {audienceLabel(a.audience, a.audienceLabel, lang)}
                    </Pill>
                    <Pill>{channelLabel(a.channel, lang)}</Pill>
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <CalendarDays size={12} />
                      {formatWhen(a.publishedAt, lang)}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}

        {feed.items.length === 0 ? (
          <Card className="p-2">
            <EmptyState
              title={
                nothingAtAll
                  ? tt("No announcements yet", "ยังไม่มีประกาศ")
                  : filter === "unread"
                    ? tt("Nothing unread", "อ่านครบทุกประกาศแล้ว")
                    : tt("Nothing matches your search", "ไม่พบประกาศที่ตรงกับการค้นหา")
              }
              hint={
                nothingAtAll
                  ? tt(
                      "Announcements addressed to you will appear here as soon as HR publishes one.",
                      "ประกาศที่ส่งถึงคุณจะแสดงที่นี่ทันทีที่ฝ่ายบุคคลเผยแพร่",
                    )
                  : undefined
              }
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
