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
import {
  CHAPTER_KIND_LABEL,
  chapterKind,
  type Chapter,
  type ChapterKind,
  type Course,
} from "@/data/learning";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ kind badges */

export const KIND_ICON: Record<ChapterKind, typeof PlayCircle> = {
  video: PlayCircle,
  pdf: FileText,
  article: BookOpen,
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
        kind === "video" && "bg-accent/10 text-accent",
        kind === "pdf" && "bg-brand-tint text-brand",
        kind === "article" && "bg-success/10 text-success",
        className,
      )}
    >
      <Icon size={11} /> {CHAPTER_KIND_LABEL[kind][lang]}
    </span>
  );
}

/* ---------------------------------------------------------------- content */

/**
 * Renders one chapter according to its content type. Mount with
 * `key={chapter.id}` so local playback / page state resets per chapter.
 */
export function ChapterContent({
  course,
  chapter,
  index,
  complete,
  onComplete,
}: {
  course: Course;
  chapter: Chapter;
  /** zero-based position in the course */
  index: number;
  complete: boolean;
  onComplete: () => void;
}) {
  const kind = chapterKind(chapter);
  if (kind === "pdf") {
    return (
      <PdfPanel
        course={course}
        chapter={chapter}
        index={index}
        complete={complete}
        onComplete={onComplete}
      />
    );
  }
  if (kind === "article") {
    return (
      <ArticlePanel
        course={course}
        chapter={chapter}
        index={index}
        complete={complete}
        onComplete={onComplete}
      />
    );
  }
  return (
    <VideoPanel
      course={course}
      chapter={chapter}
      index={index}
      complete={complete}
      onComplete={onComplete}
    />
  );
}

type PanelProps = {
  course: Course;
  chapter: Chapter;
  index: number;
  complete: boolean;
  onComplete: () => void;
};

/* ---------------------------------------------------------------- overlay */

function PanelHeader({
  course,
  chapter,
  index,
  right,
}: {
  course: Course;
  chapter: Chapter;
  index: number;
  right: React.ReactNode;
}) {
  const { tt, lang } = useT();
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-white">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">
          {lang === "th" ? course.titleTh ?? course.title : course.title}
        </p>
        <p className="truncate text-xs text-white/70">
          {tt("Chapter", "บทที่")} {index + 1} |{" "}
          {lang === "th" ? chapter.titleTh ?? chapter.title : chapter.title}
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
          course.cover,
        )}
      />
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? tt("Pause chapter", "หยุดชั่วคราว") : tt("Play chapter", "เล่นบทเรียน")}
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

  const title = lang === "th" ? chapter.titleTh ?? chapter.title : chapter.title;
  const summary = lang === "th" ? chapter.summaryTh ?? chapter.summary : chapter.summary;
  const bullets =
    lang === "th" && chapter.bulletsTh?.length ? chapter.bulletsTh : chapter.bullets;
  const bullet = bullets[(page - 1) % Math.max(1, bullets.length)];

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl bg-ink sm:aspect-video sm:h-auto">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-25",
          course.cover,
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
              {page >= pages ? tt("End of document", "จบเอกสาร") : tt("Reading", "กำลังอ่าน")}
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

function ArticlePanel({ course, chapter, index, complete, onComplete }: PanelProps) {
  const { tt, lang } = useT();
  const title = lang === "th" ? chapter.titleTh ?? chapter.title : chapter.title;
  const summary = lang === "th" ? chapter.summaryTh ?? chapter.summary : chapter.summary;
  const body =
    (lang === "th" ? chapter.bodyTh ?? chapter.body : chapter.body) ?? summary;
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-[0_2px_10px_rgba(16,24,40,.06)]">
      <div className={cn("h-2 w-full bg-gradient-to-r", course.cover)} />
      <div className="p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind="article" />
          <span className="text-[11px] text-muted">
            {tt("Chapter", "บทที่")} {index + 1} · {chapter.minutes}{" "}
            {tt("min read", "นาทีในการอ่าน")}
          </span>
          {complete ? (
            <Pill tone="success">{tt("Read", "อ่านแล้ว")}</Pill>
          ) : null}
        </div>

        <h2 className="mt-2 text-xl font-medium tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm font-bold text-ink">{summary}</p>

        <div className="scroll-thin mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm font-light leading-relaxed text-muted">
              {p}
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
