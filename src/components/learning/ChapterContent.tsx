"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Pause,
  Play,
  PlayCircle,
} from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CHAPTER_KIND_LABEL,
  FALLBACK_COVER,
  pick,
  type ChapterKind,
} from "./model";
import type { PlayerChapter } from "@/server/learning";
import { PdfReader } from "./PdfReader";
import { SEEK_EVENT, takePendingSeek, type SeekRequest } from "./lesson-seek";

/* ------------------------------------------------------------ kind badges */

export const KIND_ICON: Record<ChapterKind, typeof PlayCircle> = {
  VIDEO: PlayCircle,
  PDF: FileText,
  ARTICLE: BookOpen,
};

export function KindBadge({
  kind,
  className,
}: {
  kind: ChapterKind;
  className?: string;
}) {
  const { lang } = useT();
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        kind === "VIDEO" && "bg-accent/10 text-accent",
        kind === "PDF" && "bg-brand-tint text-brand",
        kind === "ARTICLE" && "bg-success/10 text-success",
        className,
      )}
    >
      <Icon size={11} /> {CHAPTER_KIND_LABEL[kind][lang]}
    </span>
  );
}

/* ---------------------------------------------------------------- content */

/** What a panel needs to know about the course around the chapter. */
export type PanelCourse = {
  titleEn: string;
  titleTh: string | null;
  cover: string | null;
};

type PanelProps = {
  course: PanelCourse;
  chapter: PlayerChapter;
  /** zero-based position in the course */
  index: number;
  complete: boolean;
  onComplete: () => void;
};

/**
 * Renders one chapter according to its content type. Mount with
 * `key={chapter.id}` so local playback / page state resets per chapter.
 *
 * Reaching the end of a video, the last page of a PDF or pressing "I have read
 * this" on an article all call `onComplete`, which is the server action that
 * writes the `ChapterProgress` row. The panel itself never records anything.
 */
export function ChapterContent(props: PanelProps) {
  const uploaded = Boolean(props.chapter.mediaUrl);
  if (props.chapter.kind === "PDF")
    return uploaded ? <UploadedPdfPanel {...props} /> : <PdfPanel {...props} />;
  if (props.chapter.kind === "ARTICLE") return <ArticlePanel {...props} />;
  return uploaded ? <UploadedVideoPanel {...props} /> : <VideoPanel {...props} />;
}

/* ------------------------------------------------------ uploaded media */

/** How much of a video counts as watched: the closing credits are optional. */
const WATCHED = 0.9;

function UploadedVideoPanel({ course, chapter, index, complete, onComplete }: PanelProps) {
  const { tt, lang } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const finished = useRef(complete);
  const [now, setNow] = useState(0);
  const transcript = chapter.transcript;
  const cues = transcript?.cues ?? [];
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  };

  const jump = (sec: number) => {
    const v = video.current;
    // a citation of the chapter's text, not of a moment in the video
    if (!v || sec < 0) return;
    v.currentTime = sec;
    void v.play().catch(() => {});
    v.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // a transcript line or an assistant citation asked for a moment in this video
  useEffect(() => {
    const onSeek = (e: Event) => {
      const d = (e as CustomEvent<SeekRequest>).detail;
      if (d.chapterId === chapter.id && takePendingSeek(chapter.id) !== null) jump(d.sec);
    };
    window.addEventListener(SEEK_EVENT, onSeek);
    return () => window.removeEventListener(SEEK_EVENT, onSeek);
  }, [chapter.id]);

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-xl bg-ink">
        <video
          ref={video}
          src={chapter.mediaUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
          onLoadedMetadata={() => {
            const sec = takePendingSeek(chapter.id);
            if (sec !== null) jump(sec);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setNow(v.currentTime);
            if (v.duration && v.currentTime / v.duration >= WATCHED) finish();
          }}
          onEnded={finish}
        >
          {transcript?.status === "READY" ? (
            <track kind="subtitles" src={`/api/captions/${transcript.id}`} srcLang="th" label="ไทย" default />
          ) : null}
          {tt("Your browser cannot play this video.", "เบราว์เซอร์ของคุณเล่นวิดีโอนี้ไม่ได้")}
        </video>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-white">
          <p className="min-w-0 truncate text-xs text-white/75">
            {pick(lang, course.titleEn, course.titleTh)} · {tt("Chapter", "บทที่")} {index + 1}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-white/70">
            <Clock size={12} /> {chapter.minutes} {tt("min", "นาที")}
          </span>
        </div>
      </div>

      {transcript && transcript.status !== "READY" && transcript.status !== "FAILED" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="size-3 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          {tt(
            `Making subtitles for this video… ${transcript.percent}%`,
            `กำลังสร้างคำบรรยายของวิดีโอนี้… ${transcript.percent}%`,
          )}
        </p>
      ) : null}

      {cues.length ? <TranscriptList cues={cues} now={now} onJump={jump} /> : null}
    </div>
  );
}

/** What is said in the video, line by line; the line playing now is lit, and any line plays from there. */
function TranscriptList({
  cues,
  now,
  onJump,
}: {
  cues: { startMs: number; endMs: number; text: string }[];
  now: number;
  onJump: (sec: number) => void;
}) {
  const { tt } = useT();
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const ms = now * 1000;
  const current = cues.findIndex((c) => ms >= c.startMs && ms < c.endMs);

  // keep the line being spoken in view while the list is open
  useEffect(() => {
    if (!open || current < 0) return;
    const el = list.current?.children[current] as HTMLElement | undefined;
    const box = list.current;
    if (el && box && (el.offsetTop < box.scrollTop || el.offsetTop > box.scrollTop + box.clientHeight - 40)) {
      box.scrollTo({ top: el.offsetTop - 40, behavior: "smooth" });
    }
  }, [current, open]);

  const clock = (msv: number) => {
    const s = Math.floor(msv / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="mt-3 rounded-xl border border-line/70 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-ink max-lg:min-h-11"
      >
        <span className="inline-flex items-center gap-2">
          <FileText size={15} className="text-brand" />
          {tt("Transcript", "ข้อความในวิดีโอ")}
          <span className="text-xs font-normal text-muted">
            {tt(`${cues.length} lines`, `${cues.length} ท่อน`)}
          </span>
        </span>
        <ChevronRight size={16} className={cn("text-muted transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <ol ref={list} className="scroll-thin relative max-h-72 overflow-y-auto border-t border-line/70 px-2 py-2">
          {cues.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onJump(c.startMs / 1000)}
                className={cn(
                  "flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  i === current ? "bg-brand-tint text-ink" : "text-muted hover:bg-surface hover:text-ink",
                )}
              >
                <span className="w-10 shrink-0 font-mono text-xs leading-6 text-brand">{clock(c.startMs)}</span>
                <span className="leading-6">{c.text}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function UploadedPdfPanel({ chapter, complete, onComplete }: PanelProps) {
  const { lang } = useT();
  const finished = useRef(complete);
  return (
    <PdfReader
      url={chapter.mediaUrl ?? ""}
      title={pick(lang, chapter.titleEn, chapter.titleTh)}
      onPage={(page, pages) => {
        if (page >= pages && !finished.current) {
          finished.current = true;
          onComplete();
        }
      }}
    />
  );
}

/* ---------------------------------------------------------------- overlay */

function PanelHeader({
  course,
  chapter,
  index,
  right,
}: {
  course: PanelCourse;
  chapter: PlayerChapter;
  index: number;
  right: React.ReactNode;
}) {
  const { tt, lang } = useT();
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-white">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">
          {pick(lang, course.titleEn, course.titleTh)}
        </p>
        <p className="truncate text-xs text-white/70">
          {tt("Chapter", "บทที่")} {index + 1} |{" "}
          {pick(lang, chapter.titleEn, chapter.titleTh)}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px]">
        {right}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ video */

function VideoPanel({ course, chapter, index, complete, onComplete }: PanelProps) {
  const { tt } = useT();
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(complete ? 100 : 0);
  const timer = useRef<number | null>(null);
  const finished = useRef(complete);

  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = window.setInterval(() => {
      setPos((p) => Math.min(100, p + 2));
    }, 140);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing]);

  useEffect(() => {
    if (pos >= 100 && !finished.current) {
      finished.current = true;
      setPlaying(false);
      onComplete();
    }
  }, [pos, onComplete]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-ink">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30",
          course.cover ?? FALLBACK_COVER,
        )}
      />
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={
          playing
            ? tt("Pause chapter", "หยุดชั่วคราว")
            : tt("Play chapter", "เล่นบทเรียน")
        }
        className="absolute inset-0 grid place-items-center"
      >
        <span className="grid size-20 place-items-center rounded-full bg-accent text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:size-24">
          {playing ? (
            <Pause size={34} fill="currentColor" />
          ) : (
            <Play size={34} fill="currentColor" className="ml-1.5" />
          )}
        </span>
      </button>

      <PanelHeader
        course={course}
        chapter={chapter}
        index={index}
        right={
          <>
            <Clock size={12} /> {chapter.minutes} {tt("min", "นาที")}
          </>
        }
      />

      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${pos}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-white/70">
          <span>
            {playing
              ? tt("Playing…", "กำลังเล่น…")
              : pos >= 100
                ? tt("Finished", "ดูจบแล้ว")
                : tt("Paused", "หยุดชั่วคราว")}
          </span>
          <span>{Math.round(pos)}%</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- pdf */

function PdfPanel({ course, chapter, index, complete, onComplete }: PanelProps) {
  const { tt, lang } = useT();
  const pages = Math.max(1, chapter.pages ?? 10);
  const [page, setPage] = useState(complete ? pages : 1);
  const reached = useRef(complete);

  useEffect(() => {
    if (page >= pages && !reached.current) {
      reached.current = true;
      onComplete();
    }
  }, [page, pages, onComplete]);

  const title = pick(lang, chapter.titleEn, chapter.titleTh);
  const summary = pick(lang, chapter.summaryEn ?? title, chapter.summaryTh);
  const bullets =
    lang === "th" && chapter.bulletsTh.length
      ? chapter.bulletsTh
      : chapter.bulletsEn;
  const bullet = bullets.length
    ? bullets[(page - 1) % bullets.length]
    : summary;

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl bg-ink sm:aspect-video sm:h-auto">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-25",
          course.cover ?? FALLBACK_COVER,
        )}
      />

      <PanelHeader
        course={course}
        chapter={chapter}
        index={index}
        right={
          <>
            <FileText size={12} /> {pages} {tt("pages", "หน้า")}
          </>
        }
      />

      {/* the "reader" sheet */}
      <div className="absolute inset-0 grid place-items-center px-4 pb-16 pt-16">
        <div className="flex h-full w-full max-w-[420px] flex-col rounded-md bg-white p-4 shadow-2xl sm:p-5">
          <p className="text-[10px] uppercase tracking-[.18em] text-line-2">
            {tt("Page", "หน้า")} {page} / {pages}
          </p>
          <p className="mt-1 truncate text-sm font-bold text-ink">{title}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">
            {page === 1 ? summary : bullet}
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="block h-1.5 rounded-full bg-surface"
                style={{ width: `${96 - ((page * 7 + i * 11) % 38)}%` }}
              />
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-[9px] text-line-2">1MOBY LMS</span>
            <span className="text-[9px] text-line-2">
              {chapter.minutes} {tt("min read", "นาที")}
            </span>
          </div>
        </div>
      </div>

      {/* page controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label={tt("Previous page", "หน้าก่อนหน้า")}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-35"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${(page / pages) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-white/70">
            <span>
              {tt("Page", "หน้า")} {page} {tt("of", "จาก")} {pages}
            </span>
            <span>
              {page >= pages
                ? tt("End of document", "จบเอกสาร")
                : tt("Reading", "กำลังอ่าน")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages}
          aria-label={tt("Next page", "หน้าถัดไป")}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white transition hover:brightness-95 disabled:opacity-35"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setPage(pages)}
          disabled={page >= pages}
          className="hidden shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/25 disabled:opacity-35 sm:block"
        >
          {tt("Jump to end", "ข้ามไปหน้าสุดท้าย")}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- article */

/** `pendingApprovals` in an article's text is shown as code, not with backticks. */
function withInlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] font-normal text-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function ArticlePanel({ course, chapter, index, complete, onComplete }: PanelProps) {
  const { tt, lang } = useT();
  const title = pick(lang, chapter.titleEn, chapter.titleTh);
  const summary = pick(lang, chapter.summaryEn ?? title, chapter.summaryTh);
  const body = pick(lang, chapter.bodyEn ?? summary, chapter.bodyTh);
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-[0_2px_10px_rgba(16,24,40,.06)]">
      <div
        className={cn(
          "h-2 w-full bg-gradient-to-r",
          course.cover ?? FALLBACK_COVER,
        )}
      />
      <div className="p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind="ARTICLE" />
          <span className="text-[11px] text-muted">
            {tt("Chapter", "บทที่")} {index + 1} · {chapter.minutes}{" "}
            {tt("min read", "นาทีในการอ่าน")}
          </span>
          {complete ? <Pill tone="success">{tt("Read", "อ่านแล้ว")}</Pill> : null}
        </div>

        <h2 className="mt-2 text-xl font-medium tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-1 text-sm font-bold text-ink">{summary}</p>

        <div className="scroll-thin mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm font-light leading-relaxed text-muted">
              {withInlineCode(p)}
            </p>
          ))}
        </div>

        {!complete ? (
          <Button className="mt-5" onClick={onComplete}>
            <BookOpen size={16} /> {tt("I have read this", "อ่านจบแล้ว")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
