"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertEmployee, recordActivity } from "@/server/session";
import { courseProgress } from "@/server/learning";
import {
  disclose,
  gradePaper,
  publicPaper,
  type PublicPaper,
  type ReviewItem,
  type TestKind,
} from "@/server/course-test";
import {
  LMS_POINTS,
  PASS_MARK,
  POINT_REASON,
  POINT_REF,
} from "@/components/learning/model";

/**
 * Every write the LMS makes.
 *
 * The shape is the same each time: validate with zod, `assertEmployee()` to
 * find out *who is asking* — the browser never supplies an employee id — write,
 * record the activity, then revalidate. Expected failures come back as a code
 * the client renders through `tt()`; only a genuine bug throws.
 *
 * Two things are guarded rather than assumed:
 *   - **points are append-only.** Nothing here reads a balance and writes it
 *     back. An award is a `PointLedger` row, and the guard against awarding it
 *     twice is a lookup on `(refType, refId)`, not a flag on the enrolment.
 *   - **completion is claimed atomically.** `completedAt` is set with a
 *     conditional `updateMany`, so of two tabs finishing the last chapter at
 *     once exactly one wins the award.
 */

export type LmsError =
  | "not_authorised"
  | "invalid"
  | "not_found"
  | "not_complete"
  | "pretest_required"
  | "pretest_taken"
  /** the question bank changed after the paper was handed out */
  | "paper_changed";

export type LmsResult<T> = { ok: true; data: T } | { ok: false; error: LmsError };

const fail = (error: LmsError): LmsResult<never> => ({ ok: false, error });

/** A competency name in both languages, so a toast can be bilingual. */
export type GoalNotice = { nameEn: string; nameTh: string | null };

function revalidateLearning(slug?: string) {
  revalidatePath("/lms");
  if (slug) revalidatePath(`/lms/${slug}`);
  revalidatePath("/idp");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  // the notification bell lives in the shell
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------- certificates */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function candidateCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `1M-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** A code nobody holds yet. `Certificate.code` is unique and is printed. */
async function freshCertificateCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = candidateCode();
    const clash = await db.certificate.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // astronomically unlikely; fall back to something that cannot collide
  return `1M-${Date.now().toString(36).toUpperCase()}`;
}

/* ------------------------------------------------------------------ points */

/**
 * Appends a ledger row unless this exact award already exists.
 * Returns what was actually awarded, which is 0 on a repeat.
 */
async function awardOnce(input: {
  employeeId: string;
  delta: number;
  reason: string;
  refType: string;
  refId: string;
}): Promise<number> {
  const existing = await db.pointLedger.findFirst({
    where: {
      employeeId: input.employeeId,
      refType: input.refType,
      refId: input.refId,
    },
    select: { id: true },
  });
  if (existing) return 0;
  await db.pointLedger.create({
    data: {
      employeeId: input.employeeId,
      delta: input.delta,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
    },
  });
  return input.delta;
}

/* --------------------------------------------------------- chapter progress */

const chapterSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  chapterId: z.string().trim().min(1).max(200),
});

export type ChapterResult = {
  progress: number;
  courseComplete: boolean;
  /** 0 when the course was already complete, so nothing was awarded again */
  pointsAwarded: number;
  /** the viewer's own goals this course finishes */
  goals: GoalNotice[];
};

/**
 * "เมื่อผู้เรียนเรียนจบใน LMS ระบบสามารถอัปเดตสถานะใน IDP อัตโนมัติ".
 *
 * Marking the last chapter closes the enrolment, awards the course points once
 * and tells the learner that the development goal built on this course is now
 * done — which earns that goal's own points, once per goal. The goal's own percentage is *derived* from these chapter rows, so
 * nothing is written onto it — the notification is the only new fact.
 */
export async function completeChapterAction(
  input: z.infer<typeof chapterSchema>,
): Promise<LmsResult<ChapterResult>> {
  const parsed = chapterSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { slug, chapterId } = parsed.data;

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }
  const employeeId = viewer.employeeId;

  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      status: true,
      chapters: { select: { id: true } },
    },
  });
  if (!course || course.status !== "PUBLISHED") return fail("not_found");
  // the chapter id came from the browser, so it is checked against the course
  if (!course.chapters.some((c) => c.id === chapterId)) return fail("not_found");

  // the pre-test comes first: chapters open only once a baseline is on record.
  // Someone who was already part-way through before it was required carries on.
  const [pre, started] = await Promise.all([
    db.testResult.findUnique({
      where: { employeeId_courseId_kind: { employeeId, courseId: course.id, kind: "PRE" } },
      select: { id: true },
    }),
    db.chapterProgress.count({ where: { enrollment: { employeeId, courseId: course.id } } }),
  ]);
  if (!pre && started === 0) return fail("pretest_required");

  const enrollment = await db.enrollment.upsert({
    where: { employeeId_courseId: { employeeId, courseId: course.id } },
    update: {},
    create: { employeeId, courseId: course.id },
    select: { id: true, completedAt: true },
  });

  await db.chapterProgress.upsert({
    where: {
      enrollmentId_chapterId: { enrollmentId: enrollment.id, chapterId },
    },
    update: {},
    create: { enrollmentId: enrollment.id, chapterId },
  });

  const done = await db.chapterProgress.count({
    where: { enrollmentId: enrollment.id },
  });
  const total = course.chapters.length;
  const finished = total > 0 && done >= total;

  let pointsAwarded = 0;
  let goals: GoalNotice[] = [];

  if (finished) {
    // exactly one caller flips this, whatever the concurrency
    const claimed = await db.enrollment.updateMany({
      where: { id: enrollment.id, completedAt: null },
      data: { completedAt: new Date() },
    });

    if (claimed.count === 1) {
      pointsAwarded = await awardOnce({
        employeeId,
        delta: LMS_POINTS.course,
        reason: POINT_REASON.course,
        refType: POINT_REF.course,
        refId: course.id,
      });

      const linked = await db.idpGoal.findMany({
        where: { employeeId, courseId: course.id },
        select: {
          id: true,
          fromLevel: true,
          toLevel: true,
          competency: { select: { nameEn: true, nameTh: true } },
        },
      });
      goals = linked.map((g) => ({
        nameEn: g.competency.nameEn,
        nameTh: g.competency.nameTh,
      }));

      // each goal this course closes earns its own points, once per goal —
      // keyed on the goal id, so a goal re-linked to another course or a
      // course finished again never pays twice
      for (const g of linked) {
        pointsAwarded += await awardOnce({
          employeeId,
          delta: LMS_POINTS.idpGoal,
          reason: POINT_REASON.idpGoal,
          refType: POINT_REF.idpGoal,
          refId: g.id,
        });
      }

      if (linked.length) {
        await db.notification.createMany({
          data: linked.map((g) => ({
            employeeId,
            kind: "IDP" as const,
            channel: "BOTH" as const,
            titleEn: `Development goal complete — ${g.competency.nameEn}`,
            titleTh: `เป้าหมายพัฒนาเสร็จสิ้น — ${g.competency.nameTh ?? g.competency.nameEn}`,
            bodyEn: `You finished ${course.titleEn}, so ${g.competency.nameEn} (level ${g.fromLevel} → ${g.toLevel}) now shows as complete in your development plan.`,
            bodyTh: `คุณเรียนจบ ${course.titleTh ?? course.titleEn} แล้ว เป้าหมาย ${g.competency.nameTh ?? g.competency.nameEn} (ระดับ ${g.fromLevel} → ${g.toLevel}) จึงแสดงว่าเสร็จสิ้นในแผนพัฒนาของคุณ`,
            href: "/idp",
          })),
        });
      }

      await recordActivity({
        viewer,
        action: "Completed course",
        targetType: "Course",
        targetId: course.id,
        targetLabel: course.titleEn,
        detail: linked.length
          ? `100% · closes ${linked.length} development goal(s)`
          : "100%",
      });
    }
  } else {
    await recordActivity({
      viewer,
      action: "Completed chapter",
      targetType: "Course",
      targetId: course.id,
      targetLabel: course.titleEn,
      detail: `${done}/${total}`,
    });
  }

  revalidateLearning(slug);
  return {
    ok: true,
    data: {
      progress: courseProgress(done, total, finished ? new Date() : null),
      courseComplete: finished,
      pointsAwarded,
      goals,
    },
  };
}

/* -------------------------------------------------------------------- tests */

const paperSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  kind: z.enum(["PRE", "POST"]),
});

const testSchema = paperSchema.extend({
  /** the key of the paper the browser was given, from getTestPaperAction */
  paperKey: z.string().trim().min(1).max(64),
  /** the option picked for each question, in paper order; null = unanswered */
  answers: z.array(z.number().int().min(0).max(9).nullable()).max(50),
});

export type TestOutcome = {
  score: number;
  passed: boolean;
  /** true only when this call is what issued it */
  certificateIssued: boolean;
  certificateCode: string | null;
  pointsAwarded: number;
  /**
   * What the learner may see of the key now that the paper is in: nothing for
   * the pre-test, right/wrong only for a failed post-test, the full key and
   * explanations for a passed one (see `disclose`).
   */
  review: ReviewItem[];
};

type TestCourse = { id: string; titleEn: string; titleTh: string | null; chapterCount: number };

/**
 * Who may sit which test, checked both when the paper is handed out and when
 * it is handed in: the pre-test once, before chapter 1; the post-test once
 * every chapter is done.
 */
async function testGate(
  employeeId: string,
  slug: string,
  kind: TestKind,
): Promise<{ ok: true; course: TestCourse } | { ok: false; error: LmsError }> {
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      status: true,
      _count: { select: { chapters: true } },
    },
  });
  if (!course || course.status !== "PUBLISHED") return { ok: false, error: "not_found" };

  if (kind === "PRE") {
    const [taken, started] = await Promise.all([
      db.testResult.findUnique({
        where: { employeeId_courseId_kind: { employeeId, courseId: course.id, kind: "PRE" } },
        select: { id: true },
      }),
      db.chapterProgress.count({ where: { enrollment: { employeeId, courseId: course.id } } }),
    ]);
    if (taken || started > 0) return { ok: false, error: "pretest_taken" };
  }

  if (kind === "POST") {
    // the post-test only exists once the course itself is finished
    const enrollment = await db.enrollment.findUnique({
      where: { employeeId_courseId: { employeeId, courseId: course.id } },
      select: { completedAt: true, _count: { select: { chapters: true } } },
    });
    const complete =
      Boolean(enrollment?.completedAt) ||
      (course._count.chapters > 0 &&
        (enrollment?._count.chapters ?? 0) >= course._count.chapters);
    if (!complete) return { ok: false, error: "not_complete" };
  }

  return {
    ok: true,
    course: {
      id: course.id,
      titleEn: course.titleEn,
      titleTh: course.titleTh,
      chapterCount: course._count.chapters,
    },
  };
}

/**
 * Hands out the paper for a pre- or post-test — questions and options only.
 * The paper is derived from the course and the kind, so asking again returns
 * the same one; its `key` is what the answers are handed in against.
 */
export async function getTestPaperAction(
  input: z.infer<typeof paperSchema>,
): Promise<LmsResult<PublicPaper>> {
  const parsed = paperSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }

  const gate = await testGate(viewer.employeeId, parsed.data.slug, parsed.data.kind);
  if (!gate.ok) return fail(gate.error);

  return { ok: true, data: await publicPaper(gate.course.id, parsed.data.kind) };
}

/**
 * Grades and records a pre- or post-test.
 *
 * The browser sends the options it picked, never a score: the server rebuilds
 * the paper from the course and the kind, checks it is the one that was handed
 * out, and grades it. Only then does any of the answer key go back, and only
 * as much as `disclose` allows for this kind and result.
 *
 * The pre-test is taken once, before chapter 1: it is the baseline, so a retake
 * after studying would only make the improvement look bigger than it is. The
 * post-test may be retaken (`@@unique([employeeId, courseId, kind])` replaces
 * the score), and the certificate is issued at most once per person and course
 * however many times it is passed.
 */
export async function recordTestAction(
  input: z.infer<typeof testSchema>,
): Promise<LmsResult<TestOutcome>> {
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { slug, kind, paperKey, answers } = parsed.data;

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }
  const employeeId = viewer.employeeId;

  const gate = await testGate(employeeId, slug, kind);
  if (!gate.ok) return fail(gate.error);
  const { course } = gate;

  const graded = await gradePaper(course.id, kind, paperKey, answers);
  if (!graded.ok) return fail(graded.error);
  const { score } = graded;

  await db.testResult.upsert({
    where: {
      employeeId_courseId_kind: { employeeId, courseId: course.id, kind },
    },
    update: { score, takenAt: new Date() },
    create: { employeeId, courseId: course.id, kind, score },
  });

  await recordActivity({
    viewer,
    action: kind === "PRE" ? "Completed pre-test" : "Completed post-test",
    targetType: "Course",
    targetId: course.id,
    targetLabel: course.titleEn,
    detail: `${score}%`,
  });

  const passed = kind === "POST" && score >= PASS_MARK;
  let certificateIssued = false;
  let certificateCode: string | null = null;
  let pointsAwarded = 0;

  if (passed) {
    const existing = await db.certificate.findFirst({
      where: { employeeId, courseId: course.id },
      select: { code: true },
    });
    if (existing) {
      certificateCode = existing.code;
    } else {
      const code = await freshCertificateCode();
      const created = await db.certificate.create({
        data: {
          employeeId,
          courseId: course.id,
          titleEn: course.titleEn,
          titleTh: course.titleTh,
          score,
          code,
        },
        select: { code: true },
      });
      certificateIssued = true;
      certificateCode = created.code;

      pointsAwarded = await awardOnce({
        employeeId,
        delta: LMS_POINTS.postTest,
        reason: POINT_REASON.postTest,
        refType: POINT_REF.postTest,
        refId: course.id,
      });

      await db.notification.create({
        data: {
          employeeId,
          kind: "LMS",
          channel: "BOTH",
          titleEn: `Certificate issued — ${course.titleEn}`,
          titleTh: `ออกใบรับรองแล้ว — ${course.titleTh ?? course.titleEn}`,
          bodyEn: `You passed the post-test with ${score}%. Certificate ${created.code} is on your Achievements page and can be attached to a development goal as evidence.`,
          bodyTh: `คุณผ่านแบบทดสอบหลังเรียนด้วยคะแนน ${score}% ใบรับรองเลขที่ ${created.code} อยู่ในหน้าความสำเร็จ และสามารถแนบเป็นหลักฐานของเป้าหมายพัฒนาได้`,
          href: "/achievements",
        },
      });

      await recordActivity({
        viewer,
        action: "Certificate issued",
        targetType: "Certificate",
        targetId: created.code,
        targetLabel: course.titleEn,
        detail: `${score}%`,
      });
    }
  }

  revalidateLearning(slug);
  return {
    ok: true,
    data: {
      score,
      passed,
      certificateIssued,
      certificateCode,
      pointsAwarded,
      review: disclose(kind, passed, graded.review),
    },
  };
}

/* -------------------------------------------------------- learning journey */

const projectSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  deliverable: z.string().trim().min(10).max(4000),
});

export type PathProjectResult = {
  certificateCode: string | null;
  pointsAwarded: number;
  /** false when the submission was already on file */
  firstSubmission: boolean;
};

/**
 * The final project closes a learning path.
 *
 * The unlock is re-checked here rather than trusted from the client: the step
 * only opens when every course in the path is genuinely complete, which is the
 * same chapter-completion rule the rest of the LMS reads.
 */
export async function submitPathProjectAction(
  input: z.infer<typeof projectSchema>,
): Promise<LmsResult<PathProjectResult>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { slug, deliverable } = parsed.data;

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }
  const employeeId = viewer.employeeId;

  const path = await db.learningPath.findUnique({
    where: { slug },
    select: {
      id: true,
      titleEn: true,
      titleTh: true,
      status: true,
      projectTitleEn: true,
      projectPoints: true,
      steps: {
        select: {
          courseId: true,
          course: { select: { _count: { select: { chapters: true } } } },
        },
      },
    },
  });
  if (!path || path.status !== "PUBLISHED") return fail("not_found");

  const courseIds = path.steps.map((s) => s.courseId);
  const enrolments = await db.enrollment.findMany({
    where: { employeeId, courseId: { in: courseIds } },
    select: {
      courseId: true,
      completedAt: true,
      _count: { select: { chapters: true } },
    },
  });
  const byCourse = new Map(enrolments.map((e) => [e.courseId, e]));
  const everyStepDone = path.steps.every((s) => {
    const e = byCourse.get(s.courseId);
    if (!e) return false;
    const total = s.course._count.chapters;
    return courseProgress(e._count.chapters, total, e.completedAt) >= 100;
  });
  if (!everyStepDone) return fail("not_complete");

  const existing = await db.pathCompletion.findUnique({
    where: { pathId_employeeId: { pathId: path.id, employeeId } },
    select: { id: true },
  });

  await db.pathCompletion.upsert({
    where: { pathId_employeeId: { pathId: path.id, employeeId } },
    update: { deliverable },
    create: { pathId: path.id, employeeId, deliverable },
  });

  let certificate = await db.certificate.findFirst({
    where: { employeeId, pathId: path.id },
    select: { code: true },
  });
  if (!certificate) {
    certificate = await db.certificate.create({
      data: {
        employeeId,
        pathId: path.id,
        titleEn: path.titleEn,
        titleTh: path.titleTh,
        score: 100,
        code: await freshCertificateCode(),
      },
      select: { code: true },
    });
  }

  const pointsAwarded = await awardOnce({
    employeeId,
    delta: path.projectPoints,
    reason: POINT_REASON.path,
    refType: POINT_REF.path,
    refId: path.id,
  });

  if (!existing) {
    await db.notification.create({
      data: {
        employeeId,
        kind: "LMS",
        channel: "BOTH",
        titleEn: `Learning path complete — ${path.titleEn}`,
        titleTh: `จบเส้นทางการเรียนรู้ — ${path.titleTh ?? path.titleEn}`,
        bodyEn: `Your final project was submitted and certificate ${certificate.code} has been issued.`,
        bodyTh: `ระบบได้รับโปรเจกต์สุดท้ายของคุณแล้ว และออกใบรับรองเลขที่ ${certificate.code} ให้เรียบร้อย`,
        href: "/achievements",
      },
    });
  }

  await recordActivity({
    viewer,
    action: existing
      ? "Updated learning path project"
      : "Submitted learning path project",
    targetType: "LearningPath",
    targetId: path.id,
    targetLabel: path.titleEn,
    detail: path.projectTitleEn ?? undefined,
  });

  revalidatePath(`/lms/path/${slug}`);
  revalidateLearning();
  return {
    ok: true,
    data: {
      certificateCode: certificate.code,
      pointsAwarded,
      firstSubmission: !existing,
    },
  };
}
