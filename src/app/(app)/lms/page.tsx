"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Route, Search } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeading,
  Pill,
  Progress,
  Tabs,
} from "@/components/ui";
import { CourseCard } from "@/components/learning/CourseCard";
import { libraryCourses } from "@/components/learning/courseLibrary";
import { pathCompletion } from "@/components/learning/pathProgress";
import {
  CHAPTER_KINDS,
  CHAPTER_KIND_LABEL,
  LEARNING_PATHS,
  chapterKind,
  type ChapterKind,
} from "@/data/learning";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

type CategoryFilter = "All" | "Core" | "Functional" | "Managerial";
type KindFilter = "All" | ChapterKind;
type View = "courses" | "journey";

export default function LmsPage() {
  const { state } = useDemo();
  const { t, tt, lang } = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [kind, setKind] = useState<KindFilter>("All");
  const [view, setView] = useState<View>("courses");

  const courses = useMemo(() => libraryCourses(state), [state]);

  const categoryOptions = useMemo(
    () => [
      { value: "All" as const, label: tt("All", "ทั้งหมด") },
      { value: "Core" as const, label: t("group.core") },
      { value: "Functional" as const, label: t("group.functional") },
      { value: "Managerial" as const, label: t("group.managerial") },
    ],
    [t, tt],
  );

  const kindOptions = useMemo(
    () => [
      { value: "All" as const, label: tt("All types", "ทุกประเภท") },
      ...CHAPTER_KINDS.map((k) => ({
        value: k,
        label: CHAPTER_KIND_LABEL[k][lang],
      })),
    ],
    [tt, lang],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      const matchesCategory = category === "All" || c.category === category;
      const matchesKind =
        kind === "All" || c.chapters.some((ch) => chapterKind(ch) === kind);
      const matchesQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.titleTh ?? "").toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.descriptionTh ?? "").toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      return matchesCategory && matchesKind && matchesQuery;
    });
  }, [courses, query, category, kind]);

  const completed = courses.filter(
    (c) => (state.courseProgress[c.id] ?? 0) >= 100,
  ).length;
  const inProgress = courses.filter((c) => {
    const p = state.courseProgress[c.id] ?? 0;
    return p > 0 && p < 100;
  }).length;
  const overall = Math.round(
    courses.reduce((a, c) => a + (state.courseProgress[c.id] ?? 0), 0) /
      Math.max(1, courses.length),
  );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.lms")}
        subtitle={tt(
          "Course catalogue, content library and your learning path",
          "แคตตาล็อกหลักสูตร คลังเนื้อหา และเส้นทางการเรียนรู้ของคุณ",
        )}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">{tt("Courses completed", "หลักสูตรที่เรียนจบ")}</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {completed}
            <span className="text-sm font-medium text-muted"> / {courses.length}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("status.inProgress")}</p>
          <p className="mt-1 text-2xl font-bold text-brand">{inProgress}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{tt("Overall progress", "ความคืบหน้ารวม")}</p>
          <p className="mt-1 text-2xl font-bold text-ink">{overall}%</p>
          <Progress className="mt-2" value={overall} tone="amber" />
        </Card>
      </div>

      <Tabs
        className="mb-6"
        variant="underline"
        value={view}
        onChange={setView}
        options={[
          { value: "courses", label: tt("Course library", "คลังหลักสูตร") },
          {
            value: "journey",
            label: tt("Training journey", "เส้นทางการฝึกอบรม"),
          },
        ]}
      />

      {view === "courses" ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tt("Search courses", "ค้นหาหลักสูตร")}
                className="pl-9"
                aria-label={tt("Search courses", "ค้นหาหลักสูตร")}
              />
            </div>
            <Tabs value={category} onChange={setCategory} options={categoryOptions} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">
              {tt("Content type", "ประเภทเนื้อหา")}
            </span>
            {kindOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setKind(o.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  kind === o.value
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-muted hover:border-line-2 hover:text-ink",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  progress={state.courseProgress[c.id] ?? 0}
                />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                title={tt("No courses match your filters", "ไม่พบหลักสูตรที่ตรงกับตัวกรอง")}
                hint={tt(
                  "Try a different search term, category or content type.",
                  "ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือประเภทเนื้อหา",
                )}
              />
            </Card>
          )}
        </>
      ) : (
        <JourneyList />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- journeys */

function JourneyList() {
  const { state } = useDemo();
  const { tt, lang } = useT();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {LEARNING_PATHS.map((path) => {
        const { steps, done, total, percent, complete } = pathCompletion(state, path);
        const title = lang === "th" ? path.titleTh : path.title;
        const description = lang === "th" ? path.descriptionTh : path.description;
        const level = lang === "th" ? path.targetLevelTh : path.targetLevel;

        return (
          <Card key={path.id} className="flex flex-col overflow-hidden">
            <div className={cn("h-2 w-full bg-gradient-to-r", path.cover)} />
            <div className="flex min-w-0 flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                    <Route size={13} /> {tt("Learning path", "เส้นทางการเรียนรู้")}
                  </span>
                  <h3 className="mt-1 text-lg font-bold leading-snug text-ink">
                    {title}
                  </h3>
                </div>
                <Pill tone={complete ? "success" : "brand"}>{level}</Pill>
              </div>

              <p className="mt-2 text-xs text-muted">{description}</p>

              <p className="mt-3 text-xs font-medium text-ink">
                {tt(
                  `${path.courseIds.length} courses + 1 final project`,
                  `${path.courseIds.length} หลักสูตร + 1 โปรเจกต์`,
                )}
              </p>

              <ul className="mt-2 space-y-1">
                {steps.map((s) => (
                  <li
                    key={s.kind === "course" ? s.course.id : "project"}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        s.state === "complete" && "bg-success",
                        s.state === "in-progress" && "bg-amber",
                        s.state === "available" && "bg-brand",
                        s.state === "locked" && "bg-line-2",
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        s.state === "locked" ? "text-line-2" : "text-muted",
                      )}
                    >
                      {s.kind === "course"
                        ? lang === "th"
                          ? s.course.titleTh ?? s.course.title
                          : s.course.title
                        : lang === "th"
                          ? s.project.titleTh
                          : s.project.title}
                    </span>
                    {s.kind === "course" ? (
                      <span className="shrink-0 text-[11px] text-line-2">
                        {s.progress}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-muted">
                  <span>
                    {done} / {total} {tt("steps", "ขั้นตอน")}
                  </span>
                  <span className="font-medium text-ink">{percent}%</span>
                </div>
                <Progress value={percent} tone={complete ? "success" : "brand"} />
              </div>

              <div className="mt-4 flex-1" />
              <Link href={`/lms/path/${path.id}`} className="block">
                <Button className="w-full" variant={complete ? "outline" : "primary"}>
                  {complete
                    ? tt("Review journey", "ทบทวนเส้นทาง")
                    : tt("Open journey", "เปิดเส้นทางการเรียนรู้")}
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
