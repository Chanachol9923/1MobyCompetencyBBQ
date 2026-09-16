"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Megaphone, Pin, Users } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { markAnnouncementRead } from "@/server/announcements";
import type { AnnouncementCard } from "./types";
import { audienceLabel, channelLabel, formatWhen, pick } from "./format";

/**
 * The full announcement. Opening it is what records the read receipt, which is
 * why this is a client component: the server component above it only renders,
 * and a render must not write.
 */
export function AnnouncementReader({ announcement }: { announcement: AnnouncementCard }) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const recorded = useRef(false);

  useEffect(() => {
    if (announcement.read || recorded.current) return;
    recorded.current = true;
    void markAnnouncementRead(announcement.id).then((res) => {
      // the feed's unread badge is server-rendered, so refresh it once
      if (res.ok) router.refresh();
    });
  }, [announcement.id, announcement.read, router]);

  const title = pick(lang, announcement.titleEn, announcement.titleTh);
  const body = pick(lang, announcement.bodyEn, announcement.bodyTh);

  return (
    <div className="mx-auto max-w-[840px] p-6 lg:p-10">
      <Link
        href="/announcements"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {tt("All announcements", "ประกาศทั้งหมด")}
      </Link>

      <Card className="p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
            <Megaphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-medium tracking-tight text-ink">
              {announcement.pinned ? (
                <Pin
                  size={16}
                  className="mr-1.5 inline -translate-y-0.5 text-amber"
                  aria-label={tt("Pinned", "ปักหมุด")}
                />
              ) : null}
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="brand">
                <Users size={11} className="mr-1" />
                {audienceLabel(announcement.audience, announcement.audienceLabel, lang)}
              </Pill>
              <Pill>{channelLabel(announcement.channel, lang)}</Pill>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <CalendarDays size={12} />
                {formatWhen(announcement.publishedAt, lang)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 whitespace-pre-line border-t border-line/70 pt-6 text-sm leading-relaxed text-ink">
          {body}
        </div>
      </Card>

      <div className="mt-5">
        <Link href="/announcements">
          <Button variant="outline">{t("action.back")}</Button>
        </Link>
      </div>
    </div>
  );
}
