import "server-only";
import { db } from "@/lib/db";

/**
 * Course prerequisites — "take the earlier course first" (คอร์สต้องเรียนอันก่อนหน้าก่อน).
 *
 * A course can require other courses (`CoursePrerequisite`); it stays locked
 * for a learner until every one of them is completed (`Enrollment.completedAt`).
 * Three rules:
 *
 *   - **The server decides.** Every action that moves a course forward (a
 *     chapter, a test paper) asks `unmetPrerequisites` first; the lock on the
 *     card and the course page only explains what the server will refuse.
 *   - **Nobody is locked out mid-course.** Someone who already has progress in
 *     the course — a pre-test, a chapter, a completion — carries on, even if a
 *     prerequisite was added after they started.
 *   - **Only courses one can take count.** A required course that is not
 *     published cannot be finished, so it never holds anything locked.
 *
 * The table arrives with migration 0018. Until then every course is unlocked
 * and the admin editor says the list cannot be saved yet.
 */

/** A course another one requires, with this learner's progress in it. */
export type RequiredCourse = {
  id: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  progress: number;
  complete: boolean;
};

/** Where a course stands for one learner. */
export type CourseLock = {
  /** every published course it requires, met or not, in title order */
  required: RequiredCourse[];
  /** the required courses not completed yet; empty when the course is open */
  missing: RequiredCourse[];
  locked: boolean;
};

/**
 * Whether the table exists yet, asked once rather than per query: a failed
 * Prisma query would log an error each time. Once it exists it stays; an
 * absence is re-checked after a minute so the migration is picked up.
 */
let tableSeen: { exists: boolean; at: number } | null = null;
export async function prerequisiteTableExists(): Promise<boolean> {
  if (tableSeen && (tableSeen.exists || Date.now() - tableSeen.at < 60_000)) {
    return tableSeen.exists;
  }
  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public."CoursePrerequisite"') IS NOT NULL AS "exists"`;
  tableSeen = { exists: Boolean(rows[0]?.exists), at: Date.now() };
  return tableSeen.exists;
}

/** The table was dropped or renamed between the check and the query. */
function isMissingTable(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "P2021" ||
    (/CoursePrerequisite/.test(e?.message ?? "") && /does not exist/i.test(e?.message ?? ""))
  );
}

type Link = {
  courseId: string;
  requires: { id: string; slug: string; titleEn: string; titleTh: string | null; chapters: number };
};

/** The published courses each of these courses requires (all courses when no ids). */
async function loadLinks(courseIds?: string[]): Promise<Link[]> {
  if (courseIds && !courseIds.length) return [];
  if (!(await prerequisiteTableExists())) return [];
  try {
    const rows = await db.coursePrerequisite.findMany({
      where: {
        ...(courseIds ? { courseId: { in: courseIds } } : {}),
        requires: { status: "PUBLISHED" },
      },
      select: {
        courseId: true,
        requires: {
          select: { id: true, slug: true, titleEn: true, titleTh: true, _count: { select: { chapters: true } } },
        },
      },
      orderBy: { requires: { titleEn: "asc" } },
    });
    return rows.map((r) => ({
      courseId: r.courseId,
      requires: {
        id: r.requires.id,
        slug: r.requires.slug,
        titleEn: r.requires.titleEn,
        titleTh: r.requires.titleTh,
        chapters: r.requires._count.chapters,
      },
    }));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/**
 * Where each of these courses stands for one learner. A course with no
 * prerequisites is absent from the map — absent means open.
 */
export async function getCourseLocks(
  employeeId: string,
  courseIds?: string[],
): Promise<Map<string, CourseLock>> {
  const links = await loadLinks(courseIds);
  const out = new Map<string, CourseLock>();
  if (!links.length) return out;

  const targets = [...new Set(links.map((l) => l.courseId))];
  const requiredIds = [...new Set(links.map((l) => l.requires.id))];
  const [enrolments, pre] = await Promise.all([
    db.enrollment.findMany({
      where: { employeeId, courseId: { in: [...new Set([...targets, ...requiredIds])] } },
      select: { courseId: true, completedAt: true, _count: { select: { chapters: true } } },
    }),
    db.testResult.findMany({
      where: { employeeId, courseId: { in: targets }, kind: "PRE" },
      select: { courseId: true },
    }),
  ]);
  const enrolled = new Map(enrolments.map((e) => [e.courseId, e]));
  const startedPre = new Set(pre.map((p) => p.courseId));

  for (const courseId of targets) {
    const required = links
      .filter((l) => l.courseId === courseId)
      .map(({ requires: r }): RequiredCourse => {
        const e = enrolled.get(r.id);
        const complete = Boolean(e?.completedAt);
        const progress = complete
          ? 100
          : e && r.chapters > 0
            ? Math.min(99, Math.round((e._count.chapters / r.chapters) * 100))
            : 0;
        return { id: r.id, slug: r.slug, titleEn: r.titleEn, titleTh: r.titleTh, progress, complete };
      });
    const own = enrolled.get(courseId);
    // progress of one's own in this course keeps it open whatever was added since
    const started = Boolean(own?.completedAt) || (own?._count.chapters ?? 0) > 0 || startedPre.has(courseId);
    const missing = started ? [] : required.filter((r) => !r.complete);
    out.set(courseId, { required, missing, locked: missing.length > 0 });
  }
  return out;
}

/** What still stands between this learner and this course; empty = go ahead. */
export async function unmetPrerequisites(employeeId: string, courseId: string): Promise<RequiredCourse[]> {
  return (await getCourseLocks(employeeId, [courseId])).get(courseId)?.missing ?? [];
}

/* ------------------------------------------------------------------- admin */

/** Every link, course id → the ids it requires; null before migration 0018. */
export async function getAllPrerequisiteIds(): Promise<Map<string, string[]> | null> {
  if (!(await prerequisiteTableExists())) return null;
  try {
    const rows = await db.coursePrerequisite.findMany({
      select: { courseId: true, requiresCourseId: true },
    });
    const out = new Map<string, string[]>();
    for (const r of rows) out.set(r.courseId, [...(out.get(r.courseId) ?? []), r.requiresCourseId]);
    return out;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

export type PrerequisiteError = "self" | "cycle" | "unknown_course" | "not_ready";

/**
 * Whether a course (null while it is being created) may require these. Refused
 * when the list names the course itself, a course that does not exist, or
 * would close a loop — A needs B while B, through any chain, needs A, which
 * would lock both forever. Nothing is written, so a course save can ask first.
 */
export async function checkPrerequisites(
  courseId: string | null,
  requiresIds: string[],
): Promise<PrerequisiteError | null> {
  const wanted = [...new Set(requiresIds)];
  if (!wanted.length) return null;
  if (courseId && wanted.includes(courseId)) return "self";
  if (!(await prerequisiteTableExists())) return "not_ready";
  const found = await db.course.count({ where: { id: { in: wanted } } });
  if (found !== wanted.length) return "unknown_course";
  // a course being created is required by nothing yet, so it cannot close a loop
  if (!courseId) return null;

  // a loop exists when the course is reachable from anything it would require
  const edges = await db.coursePrerequisite.findMany({
    where: { courseId: { not: courseId } },
    select: { courseId: true, requiresCourseId: true },
  });
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.courseId, [...(next.get(e.courseId) ?? []), e.requiresCourseId]);
  const seen = new Set<string>();
  const stack = [...wanted];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === courseId) return "cycle";
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return null;
}

/** Replaces what a course requires, after `checkPrerequisites` agreed. */
export async function writePrerequisites(courseId: string, requiresIds: string[]): Promise<void> {
  const wanted = [...new Set(requiresIds)];
  if (!(await prerequisiteTableExists())) return;
  await db.$transaction([
    db.coursePrerequisite.deleteMany({ where: { courseId, requiresCourseId: { notIn: wanted } } }),
    db.coursePrerequisite.createMany({
      data: wanted.map((requiresCourseId) => ({ courseId, requiresCourseId })),
      skipDuplicates: true,
    }),
  ]);
}
