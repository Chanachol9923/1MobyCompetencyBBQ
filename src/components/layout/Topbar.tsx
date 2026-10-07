"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Award,
  Bell,
  BookOpen,
  ClipboardCheck,
  Gift,
  Languages,
  Megaphone,
  Menu,
  Settings2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useViewer } from "@/lib/viewer";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/announcements";
import type { NotificationRow } from "@/components/announcements/types";
import { pick, timeAgo } from "@/components/announcements/format";
import { useMobileNav } from "./mobile-nav";

const KIND_ICON = {
  ASSESSMENT: ClipboardCheck,
  IDP: Target,
  LMS: BookOpen,
  REWARD: Gift,
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Settings2,
} as const;

export function Topbar() {
  const viewer = useViewer();
  const { tt, lang, setLang } = useT();
  const { setOpen: setNavOpen } = useMobileNav();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  /**
   * The bell reads the `Notification` table for this viewer. It loads once when
   * the shell mounts and again when the panel is opened — no interval timer, so
   * an idle tab costs nothing.
   */
  const load = useCallback(async () => {
    if (!viewer.employeeId) {
      setLoaded(true);
      return;
    }
    const feed = await listMyNotifications();
    setItems(feed.items);
    setUnread(feed.unreadCount);
    setLoaded(true);
  }, [viewer.employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, load]);

  const markAllRead = () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsRead();
      await load();
    });
  };

  const openNotification = (n: NotificationRow) => {
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    setOpen(false);
    if (n.href) router.push(n.href);
    startTransition(async () => {
      await markNotificationRead(n.id);
      await load();
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/85 px-3 backdrop-blur max-lg:h-[60px] sm:px-4 lg:px-10">
      {/* nav trigger, mobile only - sits in the bar rather than floating over it.
          Below lg it is the "more" affordance next to the bottom tab bar. */}
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        aria-label={tt("Open navigation", "เปิดเมนู")}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink transition-colors duration-150 hover:bg-surface active:scale-95 active:bg-surface max-lg:size-11 lg:hidden"
      >
        <Menu size={18} />
      </button>

      <span className="flex-1" />
      {/* language */}
      <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-line">
        <Languages size={14} className="ml-2 text-muted" />
        {(["en", "th"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={cn(
              "px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 max-lg:min-h-11 max-lg:px-3",
              lang === l ? "bg-brand text-white" : "text-muted hover:bg-surface",
            )}
          >
            {l === "en" ? "EN" : "ไทย"}
          </button>
        ))}
      </div>

      {/* notifications */}
      <div className="relative shrink-0" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={tt("Notifications", "การแจ้งเตือน")}
          aria-expanded={open}
          className="relative grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors duration-150 hover:bg-surface hover:text-ink active:scale-95 active:bg-surface max-lg:size-11"
        >
          <Bell size={17} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="animate-fade-up absolute right-0 top-11 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-white shadow-xl max-lg:top-[52px]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-bold text-ink">
                {tt("Notifications", "การแจ้งเตือน")}
              </p>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="rounded px-1 text-xs font-medium text-brand transition-colors hover:underline disabled:opacity-45 disabled:hover:no-underline max-lg:min-h-11"
              >
                {tt("Mark all as read", "อ่านทั้งหมดแล้ว")}
              </button>
            </div>
            <ul className="max-h-[360px] overflow-y-auto scroll-thin max-lg:max-h-[min(360px,60dvh)]">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-xs text-muted">
                  {loaded
                    ? tt("Nothing new", "ไม่มีการแจ้งเตือนใหม่")
                    : tt("Loading...", "กำลังโหลด...")}
                </li>
              ) : (
                items.map((n) => {
                  const Icon = KIND_ICON[n.kind] ?? Award;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={cn(
                          "flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface/70 active:bg-surface",
                          !n.read && "bg-brand-tint/60",
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-ink">
                              {pick(lang, n.titleEn, n.titleTh)}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted">
                              {timeAgo(n.createdAt, lang)}
                            </span>
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-xs text-muted">
                            {pick(lang, n.bodyEn, n.bodyTh)}
                          </span>
                          {n.channel !== "IN_APP" ? (
                            <span className="mt-1 inline-block rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                              {tt("also emailed", "ส่งอีเมลด้วย")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {/* identity */}
      <div className="hidden items-center gap-2 rounded-lg border border-line px-3 py-1.5 sm:flex">
        <span className="text-xs">
          <span className="block font-semibold leading-tight text-ink">
            {viewer.name}
          </span>
          <span className="block leading-tight text-muted">
            {[lang === "th" ? (viewer.roleNameTh ?? viewer.roleName) : viewer.roleName, viewer.jobRoleName]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </div>
    </header>
  );
}
