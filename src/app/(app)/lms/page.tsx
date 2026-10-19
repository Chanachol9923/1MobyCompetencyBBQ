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

export const metadata: Metadata = { title: "Learning" };

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
 * The whole published catalogue, the learning paths, the shorts and the
 * documents arrive in one request; searching, filtering and switching tabs are
 * then instant in the browser, with the URL kept in step so a link or a
 * refresh opens the same view. Progress is this viewer's own — the employee id
 * comes from the session.
 */
export default async function LmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireEmployee();
  const query = readQuery(await searchParams);

  // all four tabs at once — the filters and tab switches then happen in the
  // browser without asking the server again
  const [{ courses, stats }, paths, shorts, documents] = await Promise.all([
    getCatalogue(viewer.employeeId, { q: "", category: "ALL", kind: "ALL" }),
    listPathViews(viewer.employeeId),
    getShortsFeed().then((r) => r.shorts),
    listDocuments().then((r) => r.documents),
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
