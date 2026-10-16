"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
 * The rows arrive already narrowed to this viewer's audience (the server never
 * sends anyone else's); the unread filter and the search then work on them in
 * the browser, instantly.
 */
export function AnnouncementFeed({
  feed,
  filter: initialFilter,
  query,
  keepView = false,
}: {
  feed: Feed;
  filter: "all" | "unread";
  query: string;
  /** on the tabbed page: keep ?view=feed when the filters change the URL */
  keepView?: boolean;
}) {
  const { t, tt, lang } = useT();
  // the whole feed is here: the unread filter and the search are instant,
  // with the URL kept in step so a refresh or a link opens the same view
  const [filter, setFilter] = useState(initialFilter);
  const [draftQuery, setDraftQuery] = useState(query);
  useEffect(() => {
    setFilter(initialFilter);
    setDraftQuery(query);
  }, [initialFilter, query]);

  const sync = (f: "all" | "unread", q: string) => {
    const params = new URLSearchParams();
    if (keepView) params.set("view", "feed");
    if (f !== "all") params.set("filter", f);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/announcements?${qs}` : "/announcements");
  };

  const items = useMemo(() => {
    const needle = draftQuery.trim().toLowerCase();
    return feed.items.filter((a) => {
      if (filter === "unread" && a.read) return false;
      if (!needle) return true;
      return [a.titleEn, a.titleTh, a.bodyEn, a.bodyTh].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [feed.items, filter, draftQuery]);

  const nothingAtAll = feed.totalCount === 0;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={filter}
            onChange={(v) => {
              setFilter(v);
              sync(v, draftQuery);
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
              setDraftQuery(v);
              sync(filter, v);
            }}
            placeholder={tt("Search announcements...", "ค้นหาประกาศ...")}
          />
        </div>
      </Card>

      <div className="mt-5 space-y-3">
        {items.map((a) => {
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

        {items.length === 0 ? (
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
                  ? tt("Announcements addressed to you will appear here as soon as they are published.",
                      "ประกาศที่ส่งถึงคุณจะแสดงที่นี่ทันทีที่มีการเผยแพร่",
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
