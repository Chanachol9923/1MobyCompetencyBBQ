import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import { getCatalogue, listPathViews } from "@/server/learning";
import { getShortsFeed, listDocuments } from "@/server/learning-media";
import {
  CHAPTER_KINDS,
  COURSE_CATEGORIES,
  type ChapterKind,
  type CourseCategory,
} from "@/components/learning/model";
import { CatalogueView, type CatalogueQuery } from "./CatalogueView";

export const metadata: Metadata = { title: "LMS · 1Moby" };

const VIEWS = ["courses", "shorts", "documents", "journey"] as const;

/** Anything the URL cannot be trusted to hold turns back into "everything". */
function readQuery(params: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };
  const category = one("category").toUpperCase();
  const kind = one("kind").toUpperCase();
  const query: CatalogueQuery = {
    q: one("q").slice(0, 120),
    category: COURSE_CATEGORIES.includes(category as CourseCategory)
      ? (category as CourseCategory)
      : "ALL",
    kind: CHAPTER_KINDS.includes(kind as ChapterKind)
      ? (kind as ChapterKind)
      : "ALL",
    view: (VIEWS as readonly string[]).includes(one("view"))
      ? (one("view") as CatalogueQuery["view"])
      : "courses",
  };
  return query;
}

/**
 * The catalogue.
 *
 * The filters live in the URL and are answered by the query, so a course the
 * search excludes never reaches the browser and the page is shareable. Progress
 * is this viewer's own — the employee id comes from the session, and a
 * catalogue of 39 courses costs three queries, not thirty-nine.
 */
export default async function LmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireEmployee();
  const query = readQuery(await searchParams);

  // each tab loads only what it shows
  const courseTab = query.view === "courses" || query.view === "journey";
  const [{ courses, stats }, paths, shorts, documents] = await Promise.all([
    courseTab
      ? getCatalogue(viewer.employeeId, {
          q: query.q,
          category: query.category,
          kind: query.kind,
        })
      : { courses: [], stats: { total: 0, completed: 0, inProgress: 0, overall: 0 } },
    query.view === "journey" ? listPathViews(viewer.employeeId) : [],
    query.view === "shorts" ? getShortsFeed().then((r) => r.shorts) : [],
    query.view === "documents" ? listDocuments().then((r) => r.documents) : [],
  ]);

  return (
    <CatalogueView
      courses={courses}
      stats={stats}
      paths={paths}
      shorts={shorts}
      documents={documents}
      query={query}
    />
  );
}
