"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  ClipboardCheck,
  Gift,
  Languages,
  Menu,
  Settings2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo, type AppNotification } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useMobileNav } from "./mobile-nav";

const KIND_ICON = {
  assessment: ClipboardCheck,
  idp: Target,
  lms: BookOpen,
  reward: Gift,
  system: Settings2,
} as const;

function timeAgo(iso: string, lang: "en" | "th") {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return lang === "th" ? `${Math.max(mins, 1)} นาทีที่แล้ว` : `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === "th" ? `${hours} ชม.ที่แล้ว` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return lang === "th" ? `${days} วันที่แล้ว` : `${days}d ago`;
}

export function Topbar() {
  const { state, person, update } = useDemo();
  const { t, tt, lang, setLang } = useT();
  const { setOpen: setNavOpen } = useMobileNav();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!person) return null;

  const mine: AppNotification[] = state.notifications.filter(
    (n) => n.audience === "*" || n.audience === person.id,
  );
  const unread = mine.filter((n) => !n.read).length;

  const markAllRead = () =>
    update((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.audience === "*" || n.audience === person.id ? { ...n, read: true } : n,
      ),
    }));

  const openNotification = (n: AppNotification) => {
    update((s) => ({
      ...s,
      notifications: s.notifications.map((x) =>
        x.id === n.id ? { ...x, read: true } : x,
      ),
    }));
    setOpen(false);
    if (n.href) router.push(n.href);
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
                className="rounded px-1 text-xs font-medium text-brand transition-colors hover:underline max-lg:min-h-11"
              >
                {tt("Mark all read", "อ่านทั้งหมดแล้ว")}
              </button>
            </div>
            <ul className="max-h-[360px] overflow-y-auto scroll-thin max-lg:max-h-[min(360px,60dvh)]">
              {mine.length === 0 ? (
                <li className="px-4 py-8 text-center text-xs text-muted">
                  {tt("Nothing new", "ไม่มีการแจ้งเตือนใหม่")}
                </li>
              ) : (
                mine.map((n) => {
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
                              {n.title}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted">
                              {timeAgo(n.createdAt, lang)}
                            </span>
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-xs text-muted">
                            {n.body}
                          </span>
                          {n.channel !== "In-app" ? (
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
            {person.name}
          </span>
          <span className="block leading-tight text-muted">
            {state.role ? t(`role.${state.role}`) : ""} · {person.grade}
          </span>
        </span>
      </div>
    </header>
  );
}
