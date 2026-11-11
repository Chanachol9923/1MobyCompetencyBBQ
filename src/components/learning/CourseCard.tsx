"use client";

import Link from "next/link";
import { BookOpen, CalendarClock, Clock, PlayCircle, Target } from "lucide-react";
import { Button, Card, Progress } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { formatDateLocale } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { KindBadge } from "./ChapterContent";
import {
  FALLBACK_COVER,
  categoryDictKey,
  pick,
  type CourseCategory,
} from "./model";
import type { CatalogueCourse } from "@/server/learning";

const CATEGORY_TONE: Record<CourseCategory, string> = {
  CORE: "bg-brand-tint text-brand",
  FUNCTIONAL: "bg-success/10 text-success border border-success/30",
  MANAGERIAL: "bg-accent/10 text-accent border border-accent/30",
};

/**
 * One catalogue card. The percentage is this viewer's own progress, computed on
 * the server from `ChapterProgress`, so the card says the same thing on every
 * device the person signs in from.
 */
export function CourseCard({ course }: { course: CatalogueCourse }) {
  const { t, tt, lang } = useT();
  const progress = course.progress;
  const started = progress > 0;
  const done = progress >= 100;
  const title = pick(lang, course.titleEn, course.titleTh);
  const description = course.descriptionEn
    ? pick(lang, course.descriptionEn, course.descriptionTh)
    : null;
  const href = `/lms/${course.slug}`;

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link
        href={href}
        aria-label={tt(`Open ${course.titleEn}`, `เปิดหลักสูตร ${title}`)}
        className={cn(
          "relative grid h-32 place-items-center bg-gradient-to-br text-white/90 transition-transform hover:scale-[1.01]",
          course.cover ?? FALLBACK_COVER,
        )}
      >
        <PlayCircle size={40} strokeWidth={1.5} />
        {done ? (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-success">
            {tt("Completed", "เรียนจบแล้ว")}
          </span>
        ) : course.assigned ? (
          <span
            className={cn(
              "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-bold",
              course.assigned.overdue ? "bg-accent text-white" : "bg-white/90 text-accent",
            )}
          >
            {course.assigned.overdue
              ? tt("Overdue", "เลยกำหนด")
              : tt("Assigned", "ได้รับมอบหมาย")}
          </span>
        ) : null}
        {course.level ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {tt(`Level ${course.level}`, `ระดับ ${course.level}`)}
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-bold leading-snug text-ink">
            {title}
          </h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
              CATEGORY_TONE[course.category],
            )}
          >
            {t(categoryDictKey(course.category))}
          </span>
        </div>

        {course.assigned ? (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-accent/5 px-2 py-1.5 text-[11px] leading-snug text-ink">
            <Target size={12} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {tt(
                `From your assessment: ${course.assigned.competencyNameEn} is at ${course.assigned.score}, your position expects ${course.assigned.expected}`,
                `จากผลประเมิน: ${course.assigned.competencyNameTh ?? course.assigned.competencyNameEn} ได้ระดับ ${course.assigned.score} ตำแหน่งของคุณคาดหวังระดับ ${course.assigned.expected}`,
              )}
            </span>
          </p>
        ) : description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted">{description}</p>
        ) : null}

        {course.assigned && !done ? (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-[11px] font-medium",
              course.assigned.overdue ? "text-accent" : "text-muted",
            )}
          >
            <CalendarClock size={12} className="shrink-0" />
            {course.assigned.overdue
              ? tt(
                  `Overdue — was due ${formatDateLocale(course.assigned.dueAt, "en-GB")}`,
                  `เลยกำหนดแล้ว — ครบกำหนด ${formatDateLocale(course.assigned.dueAt, "th-TH")}`,
                )
              : tt(
                  `Due ${formatDateLocale(course.assigned.dueAt, "en-GB")}`,
                  `ครบกำหนด ${formatDateLocale(course.assigned.dueAt, "th-TH")}`,
                )}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {course.kinds.map((k) => (
            <KindBadge key={k} kind={k} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {course.hours} {tt("hours", "ชั่วโมง")}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen size={13} /> {course.chapterCount}{" "}
            {tt("lessons", "บทเรียน")}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>{t("label.progress")}</span>
            <span className="font-medium text-ink">{progress}%</span>
          </div>
          <Progress value={progress} tone={done ? "success" : "brand"} />
        </div>

        <div className="mt-4 flex-1" />
        <Link href={href} className="block">
          <Button className="w-full" variant={done ? "outline" : "primary"}>
            {done
              ? tt("Review course", "ทบทวนหลักสูตร")
              : started
                ? t("action.continue")
                : tt("Start course", "เริ่มเรียน")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
