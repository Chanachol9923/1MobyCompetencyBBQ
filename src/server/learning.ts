import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCompetencyDictionary, getGoalRows, type GoalRow } from "@/server/team";
import { getGapRows } from "@/server/competency";
import type {
  ChapterKind,
  CourseCategory,
} from "@/components/learning/model";

/**
 * Everything `/idp`, `/lms`, `/lms/[courseId]` and `/lms/path/[pathId]` read.
 *
 * Three rules shape the file:
 *
 *   - **Progress is derived, never stored.** A course is `ChapterProgress` rows
 *     over `Chapter` rows; a goal backed by a course is the same number, which
 *     is why the IDP calls `getGoalRows` in `server/team.ts` rather than
 *     computing a second version of it here.
 *   - **No query per row.** The catalogue is 39 courses and it costs three
 *     queries, not thirty-nine: one for the rows, one for this person's
 *     enrolments, one for the counts.
 *   - **Text is bilingual at the column level.** Every row carries `...En` and
 *     `...Th` and the browser picks by `lang` with an English fallback — the
 *     server has no language of its own.
 *
 * Writes live in the two `actions.ts` files next to the screens; the only
 * mutation here is `ensureEnrollment`, because "opening a course enrols you" is
 * part of reading the player.
 */

/* ------------------------------------------------------------- the one rule */

/**
 * The single definition of "how far through a course is this person".
 *
 * `completedAt` wins outright so a course finished before a chapter was added
 * does not silently drop below 100%.
 */
export function courseProgress(
  completedChapters: number,
  totalChapters: number,
  completedAt: Date | null,
): number {
  if (completedAt) return 100;
  if (totalChapters <= 0) return 0;
  const pct = Math.round((completedChapters / totalChapters) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** enrolment rows keyed by course, as every screen below wants them. */
type EnrollmentFacts = {
  courseId: string;
  done: number;
  completedAt: Date | null;
};

async function enrollmentsFor(
  employeeId: string,
  courseIds?: string[],
): Promise<Map<string, EnrollmentFacts>> {
  const rows = await db.enrollment.findMany({
    where: {
      employeeId,
      ...(courseIds ? { courseId: { in: courseIds } } : {}),
    },
    select: {
      courseId: true,
      completedAt: true,
      _count: { select: { chapters: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.courseId,
      { courseId: r.courseId, done: r._count.chapters, completedAt: r.completedAt },
    ]),
  );
}

/* ----------------------------------------------------------------- catalogue */

export type CatalogueCourse = {
  id: string;
  /** the route key — `/lms/[courseId]` matches `Course.slug` */
  slug: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  category: CourseCategory;
  hours: number;
  cover: string | null;
  chapterCount: number;
  /** the distinct content types inside the course, in a stable order */
  kinds: ChapterKind[];
  progress: number;
  enrolled: boolean;
  complete: boolean;
};

export type CatalogueStats = {
  /** every published course, whatever the filters say */
  total: number;
  completed: number;
  inProgress: number;
  /** average progress across the whole catalogue, 0-100 */
  overall: number;
};

export type CatalogueFilters = {
  q: string;
  category: CourseCategory | "ALL";
  kind: ChapterKind | "ALL";
};

const KIND_ORDER: ChapterKind[] = ["VIDEO", "PDF", "ARTICLE"];

/**
 * The published catalogue, filtered in Postgres.
 *
 * The search box, the category tabs and the content-type chips are all part of
 * the `where` clause — a course the filters exclude is never sent to the
 * browser, which is both faster and the only way the counts can be trusted.
 */
export async function getCatalogue(
  employeeId: string,
  filters: CatalogueFilters,
): Promise<{ courses: CatalogueCourse[]; stats: CatalogueStats }> {
  const q = filters.q.trim();
  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    ...(filters.category === "ALL" ? {} : { category: filters.category }),
    ...(filters.kind === "ALL"
      ? {}
      : { chapters: { some: { kind: filters.kind } } }),
    ...(q
      ? {
          OR: [
            { titleEn: { contains: q, mode: "insensitive" } },
            { titleTh: { contains: q, mode: "insensitive" } },
            { descriptionEn: { contains: q, mode: "insensitive" } },
            { descriptionTh: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, enrolled, totalPublished] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [{ category: "asc" }, { titleEn: "asc" }],
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleTh: true,
        descriptionEn: true,
        descriptionTh: true,
        category: true,
        hours: true,
        cover: true,
        // one join for the page, not one query per card
        chapters: { select: { kind: true } },
      },
    }),
    // every enrolment this person has in the published catalogue, so both the
    // cards and the headline counters read from the same three queries
    db.enrollment.findMany({
      where: { employeeId, course: { status: "PUBLISHED" } },
      select: {
        courseId: true,
        completedAt: true,
        _count: { select: { chapters: true } },
        course: { select: { _count: { select: { chapters: true } } } },
      },
    }),
    db.course.count({ where: { status: "PUBLISHED" } }),
  ]);

  const progressByCourse = new Map<string, number>();
  for (const e of enrolled) {
    progressByCourse.set(
      e.courseId,
      courseProgress(e._count.chapters, e.course._count.chapters, e.completedAt),
    );
  }

  const courses: CatalogueCourse[] = rows.map((c) => {
    const kinds = KIND_ORDER.filter((k) => c.chapters.some((ch) => ch.kind === k));
    const progress = progressByCourse.get(c.id) ?? 0;
    return {
      id: c.id,
      slug: c.slug,
      titleEn: c.titleEn,
      titleTh: c.titleTh,
      descriptionEn: c.descriptionEn,
      descriptionTh: c.descriptionTh,
      category: c.category,
      hours: c.hours,
      cover: c.cover,
      chapterCount: c.chapters.length,
      kinds,
      progress,
      enrolled: progressByCourse.has(c.id),
      complete: progress >= 100,
    };
  });

  let completed = 0;
  let inProgress = 0;
  let sum = 0;
  for (const p of progressByCourse.values()) {
    sum += p;
    if (p >= 100) completed += 1;
    else if (p > 0) inProgress += 1;
  }

  return {
    courses,
    stats: {
      total: totalPublished,
      completed,
      inProgress,
      // averaged over the whole catalogue, so an untouched course counts as 0
      overall: totalPublished ? Math.round(sum / totalPublished) : 0,
    },
  };
}

/* -------------------------------------------------------------- the player */

export type PlayerChapter = {
  id: string;
  sortOrder: number;
  kind: ChapterKind;
  titleEn: string;
  titleTh: string | null;
  summaryEn: string | null;
  summaryTh: string | null;
  bulletsEn: string[];
  bulletsTh: string[];
  bodyEn: string | null;
  bodyTh: string | null;
  minutes: number;
  pages: number | null;
  /** the uploaded video or PDF; without one the chapter plays its built-in preview */
  mediaUrl: string | null;
  done: boolean;
};

export type PlayerCertificate = {
  id: string;
  code: string;
  score: number | null;
  issuedAt: string;
};

/** A goal of the *viewer's own* that this course is the activity for. */
export type LinkedGoal = {
  id: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  fromLevel: number;
  toLevel: number;
  complete: boolean;
};

export type PlayerView = {
  courseId: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  category: CourseCategory;
  hours: number;
  cover: string | null;
  chapters: PlayerChapter[];
  progress: number;
  complete: boolean;
  preScore: number | null;
  postScore: number | null;
  certificate: PlayerCertificate | null;
  goals: LinkedGoal[];
};

/**
 * Enrols this person if they are not enrolled already.
 *
 * Opening the player is the enrolment event, so the page calls this before it
 * reads — `@@unique([employeeId, courseId])` makes it idempotent and two tabs
 * opening at once cannot create two rows.
 */
export async function ensureEnrollment(
  employeeId: string,
  courseId: string,
): Promise<void> {
  await db.enrollment.upsert({
    where: { employeeId_courseId: { employeeId, courseId } },
    update: {},
    create: { employeeId, courseId },
  });
}

/** Resolves the route parameter — `/lms/[courseId]` carries `Course.slug`. */
export async function getCourseIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!course || course.status !== "PUBLISHED") return null;
  return course.id;
}

export async function getPlayerView(
  employeeId: string,
  slug: string,
): Promise<PlayerView | null> {
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleTh: true,
      descriptionEn: true,
      descriptionTh: true,
      category: true,
      hours: true,
      cover: true,
      status: true,
      chapters: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          kind: true,
          titleEn: true,
          titleTh: true,
          summaryEn: true,
          summaryTh: true,
          bulletsEn: true,
          bulletsTh: true,
          bodyEn: true,
          bodyTh: true,
          minutes: true,
          pages: true,
          mediaUrl: true,
        },
      },
    },
  });
  if (!course || course.status !== "PUBLISHED") return null;

  const [enrollment, tests, certificate, goals] = await Promise.all([
    db.enrollment.findUnique({
      where: { employeeId_courseId: { employeeId, courseId: course.id } },
      select: {
        completedAt: true,
        chapters: { select: { chapterId: true } },
      },
    }),
    db.testResult.findMany({
      where: { employeeId, courseId: course.id },
      select: { kind: true, score: true },
    }),
    db.certificate.findFirst({
      where: { employeeId, courseId: course.id },
      orderBy: { issuedAt: "desc" },
      select: { id: true, code: true, score: true, issuedAt: true },
    }),
    // "the viewer's own goals this course backs" — never anybody else's
    db.idpGoal.findMany({
      where: { employeeId, courseId: course.id },
      select: {
        id: true,
        fromLevel: true,
        toLevel: true,
        completedAt: true,
        competency: { select: { nameEn: true, nameTh: true } },
      },
    }),
  ]);

  const done = new Set(enrollment?.chapters.map((c) => c.chapterId) ?? []);
  const progress = courseProgress(
    done.size,
    course.chapters.length,
    enrollment?.completedAt ?? null,
  );

  return {
    courseId: course.id,
    slug: course.slug,
    titleEn: course.titleEn,
    titleTh: course.titleTh,
    descriptionEn: course.descriptionEn,
    descriptionTh: course.descriptionTh,
    category: course.category,
    hours: course.hours,
    cover: course.cover,
    chapters: course.chapters.map((ch) => ({ ...ch, done: done.has(ch.id) })),
    progress,
    complete: progress >= 100,
    preScore: tests.find((t) => t.kind === "PRE")?.score ?? null,
    postScore: tests.find((t) => t.kind === "POST")?.score ?? null,
    certificate: certificate
      ? {
          id: certificate.id,
          code: certificate.code,
          score: certificate.score,
          issuedAt: certificate.issuedAt.toISOString(),
        }
      : null,
    goals: goals.map((g) => ({
      id: g.id,
      competencyNameEn: g.competency.nameEn,
      competencyNameTh: g.competency.nameTh,
      fromLevel: g.fromLevel,
      toLevel: g.toLevel,
      complete: g.completedAt !== null,
    })),
  };
}

/* ------------------------------------------------------------ learning path */

export type StepState = "locked" | "available" | "in-progress" | "complete";

export type PathStepView = {
  courseId: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  category: CourseCategory;
  hours: number;
  chapterCount: number;
  kinds: ChapterKind[];
  progress: number;
  state: StepState;
};

export type PathView = {
  id: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  targetLevel: string | null;
  audience: string | null;
  cover: string | null;
  projectTitleEn: string | null;
  projectTitleTh: string | null;
  projectBriefEn: string | null;
  projectBriefTh: string | null;
  projectDeliverableEn: string | null;
  projectDeliverableTh: string | null;
  projectPoints: number;
  steps: PathStepView[];
  projectState: StepState;
  /** what this person submitted, once the project step is done */
  deliverable: string | null;
  certificate: PlayerCertificate | null;
  done: number;
  total: number;
  percent: number;
  complete: boolean;
};

/**
 * Every published path with this person's real position in it.
 *
 * A step unlocks only when the one before it is genuinely complete — the
 * unlock is recomputed from `ChapterProgress` on every read rather than stored,
 * so it cannot drift from what the learner actually finished. Five queries for
 * every path on the screen, not one per step.
 */
export const listPathViews = cache(
  async (employeeId: string): Promise<PathView[]> => {
    const paths = await db.learningPath.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { titleEn: "asc" },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleTh: true,
        descriptionEn: true,
        descriptionTh: true,
        targetLevel: true,
        audience: true,
        cover: true,
        projectTitleEn: true,
        projectTitleTh: true,
        projectBriefEn: true,
        projectBriefTh: true,
        projectDeliverableEn: true,
        projectDeliverableTh: true,
        projectPoints: true,
        steps: {
          orderBy: { sortOrder: "asc" },
          select: {
            courseId: true,
            course: {
              select: {
                id: true,
                slug: true,
                titleEn: true,
                titleTh: true,
                descriptionEn: true,
                descriptionTh: true,
                category: true,
                hours: true,
                chapters: { select: { kind: true } },
              },
            },
          },
        },
      },
    });
    if (paths.length === 0) return [];

    const courseIds = [
      ...new Set(paths.flatMap((p) => p.steps.map((s) => s.courseId))),
    ];
    const pathIds = paths.map((p) => p.id);

    const [enrolments, completions, certificates] = await Promise.all([
      enrollmentsFor(employeeId, courseIds),
      db.pathCompletion.findMany({
        where: { employeeId, pathId: { in: pathIds } },
        select: { pathId: true, deliverable: true },
      }),
      db.certificate.findMany({
        where: { employeeId, pathId: { in: pathIds } },
        select: { id: true, code: true, score: true, issuedAt: true, pathId: true },
      }),
    ]);
    const completionBy = new Map(completions.map((c) => [c.pathId, c]));
    const certificateBy = new Map(
      certificates.map((c) => [c.pathId as string, c]),
    );

    return paths.map((p) => {
      let previousComplete = true;
      const steps: PathStepView[] = p.steps.map((s) => {
        const total = s.course.chapters.length;
        const enrolment = enrolments.get(s.courseId);
        const progress = enrolment
          ? courseProgress(enrolment.done, total, enrolment.completedAt)
          : 0;
        const complete = progress >= 100;
        const unlocked = previousComplete;
        const state: StepState = complete
          ? "complete"
          : !unlocked
            ? "locked"
            : progress > 0
              ? "in-progress"
              : "available";
        previousComplete = complete;
        return {
          courseId: s.course.id,
          slug: s.course.slug,
          titleEn: s.course.titleEn,
          titleTh: s.course.titleTh,
          descriptionEn: s.course.descriptionEn,
          descriptionTh: s.course.descriptionTh,
          category: s.course.category,
          hours: s.course.hours,
          chapterCount: total,
          kinds: KIND_ORDER.filter((k) =>
            s.course.chapters.some((ch) => ch.kind === k),
          ),
          progress,
          state,
        };
      });

      const completion = completionBy.get(p.id);
      const projectState: StepState = completion
        ? "complete"
        : previousComplete
          ? "available"
          : "locked";
      const total = steps.length + 1;
      const done =
        steps.filter((s) => s.state === "complete").length +
        (completion ? 1 : 0);
      const certificate = certificateBy.get(p.id);

      return {
        id: p.id,
        slug: p.slug,
        titleEn: p.titleEn,
        titleTh: p.titleTh,
        descriptionEn: p.descriptionEn,
        descriptionTh: p.descriptionTh,
        targetLevel: p.targetLevel,
        audience: p.audience,
        cover: p.cover,
        projectTitleEn: p.projectTitleEn,
        projectTitleTh: p.projectTitleTh,
        projectBriefEn: p.projectBriefEn,
        projectBriefTh: p.projectBriefTh,
        projectDeliverableEn: p.projectDeliverableEn,
        projectDeliverableTh: p.projectDeliverableTh,
        projectPoints: p.projectPoints,
        steps,
        projectState,
        deliverable: completion?.deliverable ?? null,
        certificate: certificate
          ? {
              id: certificate.id,
              code: certificate.code,
              score: certificate.score,
              issuedAt: certificate.issuedAt.toISOString(),
            }
          : null,
        done,
        total,
        percent: total ? Math.round((done / total) * 100) : 0,
        complete: total > 0 && done === total,
      };
    });
  },
);

export async function getPathView(
  employeeId: string,
  slug: string,
): Promise<PathView | null> {
  const paths = await listPathViews(employeeId);
  return paths.find((p) => p.slug === slug) ?? null;
}

/* ---------------------------------------------------------------- the plan */

export type EvidenceKind = "CERTIFICATE" | "LINK" | "NOTE";

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  label: string;
  reference: string;
  createdAt: string;
  /** only for a CERTIFICATE whose row still exists */
  certificateScore: number | null;
  certificateCode: string | null;
};

/** One of the viewer's own certificates, for the evidence picker. */
export type CertificateOption = {
  id: string;
  courseId: string | null;
  titleEn: string;
  titleTh: string | null;
  score: number | null;
  code: string;
  issuedAt: string;
};

/** A course that builds the goal's competency, with this person's progress. */
export type GoalCourseOption = {
  id: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  hours: number;
  chapterCount: number;
  progress: number;
  /** true for the course the manager actually put in the plan */
  inPlan: boolean;
};

export type IdpGoalView = GoalRow & {
  group: CourseCategory;
  evidence: EvidenceItem[];
  courses: GoalCourseOption[];
};

export type IdpView = {
  goals: IdpGoalView[];
  certificates: CertificateOption[];
  /** the competency groups this person's career role is assessed on */
  assessedGroups: CourseCategory[];
};

const GROUP_ORDER: CourseCategory[] = ["CORE", "FUNCTIONAL", "MANAGERIAL"];

/**
 * One person's development plan, ready to render.
 *
 * The percentages come straight from `getGoalRows` in `server/team.ts` — the
 * rule that a course-backed goal follows its chapter completions is written
 * once, there, and the Team Profile and this screen both read it. Everything
 * else on top (evidence, the certificate picker, the course pager) is a handful
 * of `in` queries whatever the plan size.
 */
export async function getIdpView(employeeId: string): Promise<IdpView> {
  const [goals, dict, gapRows] = await Promise.all([
    getGoalRows(employeeId),
    getCompetencyDictionary(),
    getGapRows(employeeId),
  ]);

  const competencyIds = [...new Set(goals.map((g) => g.competencyId))];
  const goalIds = goals.map((g) => g.id);

  const [evidence, courses, certificates] = await Promise.all([
    goalIds.length
      ? db.goalEvidence.findMany({
          where: { goalId: { in: goalIds } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            goalId: true,
            kind: true,
            label: true,
            reference: true,
            createdAt: true,
          },
        })
      : [],
    // every published course that builds one of these competencies, in one go
    competencyIds.length
      ? db.course.findMany({
          where: { status: "PUBLISHED", competencyId: { in: competencyIds } },
          orderBy: { titleEn: "asc" },
          select: {
            id: true,
            slug: true,
            titleEn: true,
            titleTh: true,
            hours: true,
            competencyId: true,
            _count: { select: { chapters: true } },
          },
        })
      : [],
    db.certificate.findMany({
      where: { employeeId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        courseId: true,
        titleEn: true,
        titleTh: true,
        score: true,
        code: true,
        issuedAt: true,
      },
    }),
  ]);

  // the plan's own course may sit outside the competency's catalogue (a manager
  // can attach any course), so fold those ids in as well — still one query
  const planCourseIds = goals
    .map((g) => g.courseId)
    .filter((id): id is string => Boolean(id))
    .filter((id) => !courses.some((c) => c.id === id));
  const extraCourses = planCourseIds.length
    ? await db.course.findMany({
        where: { id: { in: [...new Set(planCourseIds)] } },
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleTh: true,
          hours: true,
          competencyId: true,
          _count: { select: { chapters: true } },
        },
      })
    : [];
  const allCourses = [...courses, ...extraCourses];

  const enrolments = await enrollmentsFor(
    employeeId,
    allCourses.map((c) => c.id),
  );
  const progressOf = (courseId: string, chapterCount: number) => {
    const e = enrolments.get(courseId);
    return e ? courseProgress(e.done, chapterCount, e.completedAt) : 0;
  };

  const certificateById = new Map(certificates.map((c) => [c.id, c]));
  const evidenceByGoal = new Map<string, EvidenceItem[]>();
  for (const e of evidence) {
    const cert =
      e.kind === "CERTIFICATE" ? certificateById.get(e.reference) : undefined;
    const list = evidenceByGoal.get(e.goalId) ?? [];
    list.push({
      id: e.id,
      kind: e.kind,
      label: e.label,
      reference: e.reference,
      createdAt: e.createdAt.toISOString(),
      certificateScore: cert?.score ?? null,
      certificateCode: cert?.code ?? null,
    });
    evidenceByGoal.set(e.goalId, list);
  }

  const goalViews: IdpGoalView[] = goals.map((g) => {
    const pool = allCourses.filter(
      (c) => c.competencyId === g.competencyId || c.id === g.courseId,
    );
    // the course in the plan leads the pager, then the rest of the catalogue
    const ordered = [
      ...pool.filter((c) => c.id === g.courseId),
      ...pool.filter((c) => c.id !== g.courseId),
    ];
    return {
      ...g,
      group: dict.get(g.competencyId)?.group ?? "CORE",
      evidence: evidenceByGoal.get(g.id) ?? [],
      courses: ordered.map((c) => ({
        id: c.id,
        slug: c.slug,
        titleEn: c.titleEn,
        titleTh: c.titleTh,
        hours: c.hours,
        chapterCount: c._count.chapters,
        progress: progressOf(c.id, c._count.chapters),
        inPlan: c.id === g.courseId,
      })),
    };
  });

  const assessed = new Set(gapRows.map((r) => r.group));
  for (const g of goalViews) assessed.add(g.group);

  return {
    goals: goalViews,
    certificates: certificates.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      titleEn: c.titleEn,
      titleTh: c.titleTh,
      score: c.score,
      code: c.code,
      issuedAt: c.issuedAt.toISOString(),
    })),
    assessedGroups: GROUP_ORDER.filter((g) => assessed.has(g)),
  };
}
