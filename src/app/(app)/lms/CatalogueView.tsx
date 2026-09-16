"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  CHAPTER_KINDS,
  CHAPTER_KIND_LABEL,
  COURSE_CATEGORIES,
  FALLBACK_COVER,
  categoryDictKey,
  pick,
  type ChapterKind,
  type CourseCategory,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  CatalogueCourse,
  CatalogueStats,
  PathView,
} from "@/server/learning";

export type CatalogueQuery = {
  q: string;
  category: CourseCategory | "ALL";
  kind: ChapterKind | "ALL";
  view: "courses" | "journey";
};

/**
 * The course catalogue and the training journeys.
 *
 * The search box, the category tabs and the content-type chips are not a
 * browser-side filter over a list that was sent anyway — they are the URL, and
 * the URL is the `where` clause. Changing one re-runs the query on the server,
 * which is what keeps a catalogue of any size to three queries.
 */
export function CatalogueView({
  courses,
  stats,
  paths,
  query,
}: {
  courses: CatalogueCourse[];
  stats: CatalogueStats;
  paths: PathView[];
  query: CatalogueQuery;
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(query.q);
  const typed = useRef(false);

  // keep the box in step when the URL changes underneath us (back button)
  useEffect(() => {
    if (!typed.current) setDraftQuery(query.q);
  }, [query.q]);

  const go = (next: Partial<CatalogueQuery>) => {
    const merged = { ...query, q: draftQuery, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.category !== "ALL") params.set("category", merged.category);
    if (merged.kind !== "ALL") params.set("kind", merged.kind);
    if (merged.view !== "courses") params.set("view", merged.view);
    const qs = params.toString();
    router.replace(qs ? `/lms?${qs}` : "/lms");
  };

  // debounce the search so a keystroke is not a query
  useEffect(() => {
    if (!typed.current) return;
    const id = window.setTimeout(() => go({ q: draftQuery }), 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  const categoryOptions = [
    { value: "ALL" as const, label: t("label.all") },
    ...COURSE_CATEGORIES.map((c) => ({
      value: c,
      label: t(categoryDictKey(c)),
    })),
  ];

  const kindOptions = [
    { value: "ALL" as const, label: tt("All types", "ทุกประเภท") },
    ...CHAPTER_KINDS.map((k) => ({
      value: k,
      label: CHAPTER_KIND_LABEL[k][lang],
    })),
  ];

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
          <p className="text-xs text-muted">
            {tt("Courses completed", "หลักสูตรที่เรียนจบ")}
          </p>
          <p className="mt-1 text-2xl font-bold text-success">
            {stats.completed}
            <span className="text-sm font-medium text-muted">
              {" "}
              / {stats.total}
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("status.inProgress")}</p>
          <p className="mt-1 text-2xl font-bold text-brand">{stats.inProgress}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">
            {tt("Overall progress", "ความคืบหน้ารวม")}
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{stats.overall}%</p>
          <Progress className="mt-2" value={stats.overall} tone="amber" />
        </Card>
      </div>

      <Tabs
        className="mb-6"
        variant="underline"
        value={query.view}
        onChange={(view) => {
          typed.current = false;
          go({ view });
        }}
        options={[
          { value: "courses" as const, label: tt("Course library", "คลังหลักสูตร") },
          {
            value: "journey" as const,
            label: tt("Training journey", "เส้นทางการฝึกอบรม"),
          },
        ]}
      />

      {query.view === "courses" ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={draftQuery}
                onChange={(e) => {
                  typed.current = true;
                  setDraftQuery(e.target.value);
                }}
                placeholder={tt("Search courses", "ค้นหาหลักสูตร")}
                className="pl-9"
                aria-label={tt("Search courses", "ค้นหาหลักสูตร")}
              />
            </div>
            <Tabs
              value={query.category}
              onChange={(category) => {
                typed.current = false;
                go({ category });
              }}
              options={categoryOptions}
            />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">
              {tt("Content type", "ประเภทเนื้อหา")}
            </span>
            {kindOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  typed.current = false;
                  go({ kind: o.value });
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors max-lg:min-h-11",
                  query.kind === o.value
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-muted hover:border-line-2 hover:text-ink",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {courses.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                title={tt(
                  "No courses match your filters",
                  "ไม่พบหลักสูตรที่ตรงกับตัวกรอง",
                )}
                hint={tt(
                  "Try a different search term, category or content type.",
                  "ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือประเภทเนื้อหา",
                )}
              />
            </Card>
          )}
        </>
      ) : (
        <JourneyList paths={paths} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- journeys */

function JourneyList({ paths }: { paths: PathView[] }) {
  const { tt, lang } = useT();

  if (paths.length === 0) {
    return (
      <Card>
        <EmptyState
          title={tt("No learning paths yet", "ยังไม่มีเส้นทางการเรียนรู้")}
          hint={tt(
            "A learning path bundles several courses and a final project.",
            "เส้นทางการเรียนรู้คือชุดหลักสูตรหลายวิชาพร้อมโปรเจกต์ปิดท้าย",
          )}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {paths.map((path) => {
        const title = pick(lang, path.titleEn, path.titleTh);
        const description = path.descriptionEn
          ? pick(lang, path.descriptionEn, path.descriptionTh)
          : null;

        return (
          <Card key={path.id} className="flex flex-col overflow-hidden">
            <div
              className={cn(
                "h-2 w-full bg-gradient-to-r",
                path.cover ?? FALLBACK_COVER,
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                    <Route size={13} />{" "}
                    {tt("Learning path", "เส้นทางการเรียนรู้")}
                  </span>
                  <h3 className="mt-1 text-lg font-bold leading-snug text-ink">
                    {title}
                  </h3>
                </div>
                {path.targetLevel ? (
                  <Pill tone={path.complete ? "success" : "brand"}>
                    {path.targetLevel}
                  </Pill>
                ) : null}
              </div>

              {description ? (
                <p className="mt-2 text-xs text-muted">{description}</p>
              ) : null}

              <p className="mt-3 text-xs font-medium text-ink">
                {tt(
                  `${path.steps.length} courses + 1 final project`,
                  `${path.steps.length} หลักสูตร + 1 โปรเจกต์`,
                )}
              </p>

              <ul className="mt-2 space-y-1">
                {path.steps.map((s) => (
                  <li
                    key={s.courseId}
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
                      {pick(lang, s.titleEn, s.titleTh)}
                    </span>
                    <span className="shrink-0 text-[11px] text-line-2">
                      {s.progress}%
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      path.projectState === "complete" && "bg-success",
                      path.projectState === "available" && "bg-brand",
                      path.projectState === "locked" && "bg-line-2",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      path.projectState === "locked"
                        ? "text-line-2"
                        : "text-muted",
                    )}
                  >
                    {path.projectTitleEn
                      ? pick(lang, path.projectTitleEn, path.projectTitleTh)
                      : tt("Final project", "โปรเจกต์สุดท้าย")}
                  </span>
                </li>
              </ul>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-muted">
                  <span>
                    {path.done} / {path.total} {tt("steps", "ขั้นตอน")}
                  </span>
                  <span className="font-medium text-ink">{path.percent}%</span>
                </div>
                <Progress
                  value={path.percent}
                  tone={path.complete ? "success" : "brand"}
                />
              </div>

              <div className="mt-4 flex-1" />
              <Link href={`/lms/path/${path.slug}`} className="block">
                <Button
                  className="w-full"
                  variant={path.complete ? "outline" : "primary"}
                >
                  {path.complete
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
