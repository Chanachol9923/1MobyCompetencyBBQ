"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Heart,
  Link2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LMS_POINTS, pick } from "@/components/learning/model";
import type { ShortCard } from "@/components/learning/media-types";
import { recordShortProgress, setShortLike } from "@/server/learning-media";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

/** How much of a short counts as watched. */
const WATCHED = 0.9;
/** Slides this far from the one on screen keep their video loaded. */
const KEEP = 1;

/**
 * The Shorts feed: one vertical video per screen, scrolled like Reels.
 *
 * The slide on screen plays; every other one is paused, and only its
 * neighbours are loaded, so scrolling through fifty shorts does not download
 * fifty videos. Videos start muted because browsers refuse to autoplay sound;
 * one tap on the speaker turns sound on for the rest of the feed.
 */
export function ShortsFeed({ shorts, startId }: { shorts: ShortCard[]; startId?: string }) {
  const { tt } = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const startIndex = Math.max(0, shorts.findIndex((s) => s.id === startId));
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);

  // open on the short that was asked for
  useEffect(() => {
    const el = scroller.current;
    if (!el || !startIndex) return;
    el.scrollTo({ top: startIndex * el.clientHeight, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // every slide is exactly one screen tall, so the slide on screen is simply
  // the scroll position divided by the height — past the halfway mark it flips
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      if (el.clientHeight) setActive(Math.round(el.scrollTop / el.clientHeight));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = useCallback((index: number) => {
    const el = scroller.current;
    if (!el) return;
    const max = el.querySelectorAll("[data-index]").length - 1;
    const to = Math.min(max, Math.max(0, index));
    el.scrollTo({ top: to * el.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === "m") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  return (
    <div className="relative -mb-16 h-[calc(100dvh-56px)] bg-[#0b0b10] max-lg:h-[calc(100dvh-60px-56px-env(safe-area-inset-bottom))]">
      <div
        ref={scroller}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shorts.map((s, i) => (
          <Slide
            key={s.id}
            index={i}
            short={s}
            total={shorts.length}
            active={i === active}
            loaded={Math.abs(i - active) <= KEEP}
            muted={muted}
            onMute={() => setMuted((m) => !m)}
          />
        ))}
        <EndSlide index={shorts.length} />
      </div>

      {/* back to the learning hub */}
      <Link
        href="/lms?view=shorts"
        className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/60 lg:left-5 lg:top-5"
      >
        <ArrowLeft size={15} /> {tt("Learning", "การเรียนรู้")}
      </Link>

      {/* up / down on a desktop */}
      <div className="absolute right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        <NavButton
          label={tt("Previous short", "คลิปก่อนหน้า")}
          disabled={active <= 0}
          onClick={() => goTo(active - 1)}
        >
          <ChevronUp size={22} />
        </NavButton>
        <NavButton
          label={tt("Next short", "คลิปถัดไป")}
          disabled={active >= shorts.length}
          onClick={() => goTo(active + 1)}
        >
          <ChevronDown size={22} />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-12 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ slide */

function Slide({
  index,
  short,
  total,
  active,
  loaded,
  muted,
  onMute,
}: {
  index: number;
  short: ShortCard;
  total: number;
  active: boolean;
  loaded: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  const { tt, lang } = useT();
  const { notify } = useUi();
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(short.liked);
  const [likes, setLikes] = useState(short.likes);
  const [completed, setCompleted] = useState(short.completed);
  const [earned, setEarned] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const seen = useRef(false);
  const reported = useRef(short.completed);

  const title = pick(lang, short.titleEn, short.titleTh);
  const caption = short.captionEn ? pick(lang, short.captionEn, short.captionTh) : null;

  // play the slide on screen, pause the rest
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) {
      setPaused(false);
      v.play().catch(() => setPaused(true));
      if (!seen.current) {
        seen.current = true;
        void recordShortProgress({ shortId: short.id, completed: false }).catch(() => {});
      }
    } else {
      v.pause();
    }
  }, [active, loaded, short.id]);

  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const onTime = () => {
    const v = video.current;
    if (!v || !v.duration) return;
    const ratio = v.currentTime / v.duration;
    setProgress(ratio);
    if (ratio >= WATCHED && !reported.current) {
      reported.current = true;
      setCompleted(true);
      recordShortProgress({ shortId: short.id, completed: true })
        .then((r) => {
          if (r.points) {
            setEarned(r.points);
            window.setTimeout(() => setEarned(0), 2600);
          }
        })
        .catch(() => {
          reported.current = false;
        });
    }
  };

  const like = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const res = await setShortLike({ shortId: short.id, liked: next });
      setLikes(res.likes);
    } catch {
      setLiked(!next);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/lms/shorts?s=${short.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(tt("Link copied", "คัดลอกลิงก์แล้ว"));
    } catch {
      notify(tt("Could not copy the link", "คัดลอกลิงก์ไม่สำเร็จ"), "error");
    }
  };

  return (
    <section
      data-index={index}
      aria-label={`${title} (${index + 1}/${total})`}
      className="relative flex h-full snap-start snap-always items-center justify-center lg:py-4"
    >
      {/* on a phone the actions float over the video; on a desktop they sit beside it */}
      <div className="relative flex h-full w-full items-end lg:w-auto lg:gap-3">
      <div className="relative h-full w-full overflow-hidden bg-black lg:aspect-[9/16] lg:w-auto lg:rounded-2xl">
        {short.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={short.posterUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
        ) : null}
        {loaded ? (
          <video
            ref={video}
            src={short.videoUrl}
            poster={short.posterUrl ?? undefined}
            muted={muted}
            loop
            playsInline
            preload={active ? "auto" : "metadata"}
            onTimeUpdate={onTime}
            onClick={toggle}
            className="absolute inset-0 h-full w-full cursor-pointer object-cover"
          />
        ) : null}

        {/* paused indicator */}
        {paused && active ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={tt("Play", "เล่น")}
            className="absolute inset-0 grid place-items-center"
          >
            <span className="grid size-20 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
              <Play size={34} fill="currentColor" className="ml-1" />
            </span>
          </button>
        ) : null}

        {/* points for finishing */}
        {earned ? (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 animate-[toast-in_.25s_ease-out] rounded-full bg-amber px-4 py-2 text-sm font-bold text-white shadow-lg">
            +{earned} {tt("points", "คะแนน")}
          </div>
        ) : null}

        {/* shade so the text stays legible on a bright frame */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* what this short is */}
        <div className="absolute inset-x-0 bottom-0 p-4 pr-20 text-white lg:pr-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {short.competency ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                {pick(lang, short.competency.nameEn, short.competency.nameTh)}
              </span>
            ) : null}
            {completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/80 px-2.5 py-1 text-[11px] font-medium">
                <CheckCircle2 size={12} /> {tt("Watched", "ดูแล้ว")}
              </span>
            ) : (
              <span className="rounded-full bg-amber/85 px-2.5 py-1 text-[11px] font-medium">
                +{LMS_POINTS.short} {tt("points", "คะแนน")}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold leading-snug drop-shadow">{title}</h2>
          {caption ? (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className={cn(
                "mt-1 block text-left text-[13px] leading-snug text-white/85",
                !expanded && "line-clamp-2",
              )}
            >
              {caption}
            </button>
          ) : null}
          {short.course ? (
            <Link
              href={`/lms/${short.course.slug}`}
              className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink transition hover:bg-white/90"
            >
              <BookOpen size={14} className="shrink-0 text-brand" />
              <span className="truncate">
                {tt("Full course:", "เรียนเต็ม:")} {pick(lang, short.course.titleEn, short.course.titleTh)}
              </span>
            </Link>
          ) : null}
        </div>

        {/* time */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
          <div className="h-full bg-white transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

        {/* actions */}
        <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4 text-white lg:static lg:pb-20">
          <Action
            label={liked ? tt("Unlike", "เลิกถูกใจ") : tt("Like", "ถูกใจ")}
            caption={String(likes)}
            onClick={like}
          >
            <Heart size={26} className={cn(liked && "fill-accent text-accent")} />
          </Action>
          <Action
            label={muted ? tt("Turn sound on", "เปิดเสียง") : tt("Mute", "ปิดเสียง")}
            caption={muted ? tt("Sound", "เสียง") : tt("Mute", "ปิดเสียง")}
            onClick={onMute}
          >
            {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </Action>
          <Action label={tt("Copy link", "คัดลอกลิงก์")} caption={tt("Share", "แชร์")} onClick={share}>
            <Link2 size={24} />
          </Action>
          {active && !paused ? (
            <Action label={tt("Pause", "หยุดชั่วคราว")} caption="" onClick={toggle}>
              <Pause size={22} />
            </Action>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Action({
  label,
  caption,
  onClick,
  children,
}: {
  label: string;
  caption: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex flex-col items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,.6)] transition active:scale-90"
    >
      <span className="grid size-11 place-items-center rounded-full bg-black/25 backdrop-blur-sm">{children}</span>
      {caption ? <span className="text-[11px] font-medium">{caption}</span> : null}
    </button>
  );
}

/* -------------------------------------------------------------- the end */

function EndSlide({ index }: { index: number }) {
  const { tt } = useT();
  return (
    <section
      data-index={index}
      className="flex h-full snap-start snap-always items-center justify-center p-6 text-center text-white"
    >
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/20 text-success">
          <CheckCircle2 size={32} />
        </span>
        <h2 className="mt-4 text-xl font-bold">{tt("You're all caught up", "คุณดูครบทุกคลิปแล้ว")}</h2>
        <p className="mt-2 text-sm text-white/70">
          {tt(
            "New shorts appear here as soon as they are published. Keep going with a course or a document.",
            "คลิปใหม่จะปรากฏที่นี่ทันทีที่เผยแพร่ ระหว่างนี้เรียนต่อจากหลักสูตรหรือเอกสารได้เลย",
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/lms"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-white/90"
          >
            <BookOpen size={16} /> {tt("Courses", "หลักสูตร")}
          </Link>
          <Link
            href="/lms?view=documents"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <FileText size={16} /> {tt("Documents", "เอกสาร")}
          </Link>
        </div>
      </div>
    </section>
  );
}
