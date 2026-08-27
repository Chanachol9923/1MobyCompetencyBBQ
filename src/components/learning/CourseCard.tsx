"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Clock, PlayCircle } from "lucide-react";
import { Button, Card, Pill, Progress } from "@/components/ui";
import { courseKinds, type Course } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { KindBadge } from "./ChapterContent";

const CATEGORY_TONE: Record<Course["category"], string> = {
  Core: "bg-brand-tint text-brand",
  Functional: "bg-success/10 text-success border border-success/30",
  Managerial: "bg-accent/10 text-accent border border-accent/30",
};

const CATEGORY_KEY: Record<Course["category"], string> = {
  Core: "group.core",
  Functional: "group.functional",
  Managerial: "group.managerial",
};

export function CourseCard({
  course,
  progress,
}: {
  course: Course;
  progress: number;
}) {
  const router = useRouter();
  const { t, tt, lang } = useT();
  const started = progress > 0;
  const done = progress >= 100;
  const title = lang === "th" ? course.titleTh ?? course.title : course.title;
  const description =
    lang === "th" ? course.descriptionTh ?? course.description : course.description;

  return (
    <Card className="flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => router.push(`/lms/${course.id}`)}
        className={cn(
          "relative grid h-32 place-items-center bg-gradient-to-br text-white/90 transition-transform hover:scale-[1.01]",
          course.cover,
        )}
        aria-label={tt(`Open ${course.title}`, `เปิดหลักสูตร ${title}`)}
      >
        <PlayCircle size={40} strokeWidth={1.5} />
        {done ? (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-success">
            {tt("Completed", "เรียนจบแล้ว")}
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-bold leading-snug text-ink">{title}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
              CATEGORY_TONE[course.category],
            )}
          >
            {t(CATEGORY_KEY[course.category])}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs text-muted">{description}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {courseKinds(course).map((k) => (
            <KindBadge key={k} kind={k} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {course.hours} {tt("hours", "ชั่วโมง")}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen size={13} /> {course.lessons} {tt("lessons", "บทเรียน")}
          </span>
          {course.status === "Draft" ? (
            <Pill>{tt("Draft", "ฉบับร่าง")}</Pill>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>{t("label.progress")}</span>
            <span className="font-medium text-ink">{progress}%</span>
          </div>
          <Progress value={progress} tone={done ? "success" : "brand"} />
        </div>

        <div className="mt-4 flex-1" />
        <Button
          className="w-full"
          variant={done ? "outline" : "primary"}
          onClick={() => router.push(`/lms/${course.id}`)}
        >
          {done
            ? tt("Review course", "ทบทวนหลักสูตร")
            : started
              ? t("action.continue")
              : tt("Start course", "เริ่มเรียน")}
        </Button>
      </div>
    </Card>
  );
}
