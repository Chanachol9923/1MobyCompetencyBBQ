"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  SkipForward,
} from "lucide-react";
import { Button, Card, EmptyState, PageHeading, Pill, Progress } from "@/components/ui";
import { AiStudyPanel } from "@/components/learning/AiStudyPanel";
import {
  ChapterContent,
  KIND_ICON,
  KindBadge,
} from "@/components/learning/ChapterContent";
import { CourseTestModal, TestResultPanel } from "@/components/learning/CourseTest";
import { libraryCourse } from "@/components/learning/courseLibrary";
import type { TestVariant } from "@/components/learning/testEngine";
import {
  LMS_POINTS,
  PASS_MARK,
  chapterKind,
  type Chapter,
  type Course,
} from "@/data/learning";
import { useT } from "@/lib/i18n";
import { goalsForCourse, useDemo, type IdpGoal } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function CoursePlayerPage() {
  return (
    <Suspense fallback={<PlayerFallback />}>
      <Player />
    </Suspense>
  );
}

function PlayerFallback() {
  const { tt } = useT();
  return (
    <div className="p-6 text-sm text-muted lg:p-10">
      {tt("Loading course…", "กำลังโหลดหลักสูตร…")}
    </div>
  );
}

function Player() {
  const { state, person, update, notify, addPoints, logActivity, pushNotification } =
    useDemo();
  const { t, tt, lang } = useT();
  const params = useParams<{ courseId: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const courseId = params?.courseId ?? "";
  const course = useMemo(() => libraryCourse(state, courseId), [state, courseId]);
  const chapters = useMemo(() => course?.chapters ?? [], [course]);

  const courseTitle = (c: Course) =>
    lang === "th" ? c.titleTh ?? c.title : c.title;
  const chapterTitle = (ch: Chapter) =>
    lang === "th" ? ch.titleTh ?? ch.title : ch.title;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [testOpen, setTestOpen] = useState<TestVariant | null>(null);

  const storedProgress = state.courseProgress[courseId] ?? 0;
  const results = state.testResults[courseId];
  /** the record only exists once the learner has taken or skipped the pre-test */
  const preTestSettled = Boolean(results);

  /**
   * "เมื่อผู้เรียนเรียนจบใน LMS ระบบสามารถอัปเดตสถานะใน IDP อัตโนมัติ" — the goal
   * already derives its percentage from this course, so finishing here moves
   * the plan on its own. What is missing is the visible confirmation, so tell
   * the learner and write it to the audit trail.
   */
  const linkedGoals = useMemo<IdpGoal[]>(
    () =>
      person
        ? goalsForCourse(state, courseId)
            .filter((x) => x.personId === person.id)
            .map((x) => x.goal)
        : [],
    [state, courseId, person],
  );

  const announceGoals = useCallback(
    (courseName: string, via: "course" | "certificate") => {
      if (!person) return;
      linkedGoals.forEach((goal) => {
        logActivity(
          via === "course"
            ? "Development goal completed"
            : "Development goal evidence available",
          goal.competencyName,
          `${courseName} · ${via === "course" ? "100%" : "certificate"}`,
        );
        pushNotification({
          audience: person.id,
          title: tt(
            `Course complete — your development goal ${goal.competencyName} is now done`,
            `เรียนจบหลักสูตร — เป้าหมายพัฒนา ${goal.competencyName} เสร็จสิ้นแล้ว`,
          ),
          body:
            via === "course"
              ? tt(
                  `You finished ${courseName}, so your development plan now shows ${goal.competencyName} (level ${goal.fromLevel} → ${goal.toLevel}) as complete.`,
                  `คุณเรียนจบ ${courseName} แล้ว แผนพัฒนาของคุณจึงแสดงว่า ${goal.competencyName} (ระดับ ${goal.fromLevel} → ${goal.toLevel}) เสร็จสิ้น`,
                )
              : tt(
                  `Your certificate for ${courseName} can now be attached as evidence on ${goal.competencyName}.`,
                  `ตอนนี้คุณสามารถแนบใบรับรองของ ${courseName} เป็นหลักฐานของเป้าหมาย ${goal.competencyName} ได้แล้ว`,
                ),
          kind: "idp",
          channel: "Both",
          href: "/idp",
        });
      });
    },
    [person, linkedGoals, logActivity, pushNotification, tt],
  );

  /* seed completed chapters from the persisted course progress, once */
  useEffect(() => {
    if (seeded || !chapters.length) return;
    const count = Math.round((storedProgress / 100) * chapters.length);
    setDone(chapters.slice(0, count).map((c) => c.id));
    setSeeded(true);
  }, [seeded, chapters, storedProgress]);

  /* honour ?chapter= then fall back to the first chapter */
  useEffect(() => {
    if (activeId || !chapters.length) return;
    const wanted = search?.get("chapter");
    if (wanted && chapters.some((c) => c.id === wanted)) {
      setActiveId(wanted);
      return;
    }
    setActiveId(chapters[0]!.id);
  }, [activeId, chapters, search]);

  const chapter = chapters.find((c) => c.id === activeId) ?? chapters[0];
  const chapterIndex = chapter ? chapters.findIndex((c) => c.id === chapter.id) : -1;

  const completeChapter = useCallback(
    (id: string) => {
      if (!course || !chapters.length || done.includes(id)) return;
      const next = [...done, id];
      setDone(next);
      const pct = Math.round((next.length / chapters.length) * 100);
      const before = state.courseProgress[course.id] ?? 0;
      update((s) => ({
        ...s,
        courseProgress: { ...s.courseProgress, [course.id]: pct },
      }));
      if (pct >= 100 && before < 100) {
        if (person) addPoints(person.id, LMS_POINTS.course);
        logActivity("Completed course", course.title);
        // finishing the course closes any development goal built on it
        announceGoals(courseTitle(course), "course");
        notify(
          linkedGoals.length
            ? tt(
                `Course complete +${LMS_POINTS.course} points — your development goal “${linkedGoals[0]!.competencyName}” is now done`,
                `เรียนจบหลักสูตร +${LMS_POINTS.course} คะแนน เป้าหมายพัฒนา “${linkedGoals[0]!.competencyName}” เสร็จสิ้นแล้ว`,
              )
            : tt(
                `Course complete +${LMS_POINTS.course} points — take the post-test to earn your certificate`,
                `เรียนจบหลักสูตร +${LMS_POINTS.course} คะแนน ทำแบบทดสอบหลังเรียนเพื่อรับใบรับรอง`,
              ),
        );
      } else {
        notify(
          tt(
            `Chapter complete — ${pct}% of ${course.title}`,
            `เรียนจบบทเรียน — ${pct}% ของ ${courseTitle(course)}`,
          ),
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course, chapters, done, state.courseProgress, update, notify, addPoints, person, logActivity, announceGoals, linkedGoals, tt, lang],
  );

  /* ------------------------------------------------------------ pre-test */

  const savePre = (score: number | null) => {
    update((s) => ({
      ...s,
      testResults: {
        ...s.testResults,
        [courseId]: { pre: score, post: s.testResults[courseId]?.post ?? null },
      },
    }));
  };

  const takePre = (score: number) => {
    savePre(score);
    logActivity("Completed pre-test", course?.title ?? courseId, `${score}%`);
    notify(
      tt(`Pre-test recorded — ${score}%`, `บันทึกคะแนนก่อนเรียนแล้ว — ${score}%`),
    );
  };

  const skipPre = () => {
    savePre(null);
    logActivity("Skipped pre-test", course?.title ?? courseId);
    notify(
      tt(
        "Pre-test skipped — your baseline will show as unknown",
        "ข้ามแบบทดสอบก่อนเรียน คะแนนตั้งต้นจะแสดงเป็นไม่ทราบ",
      ),
    );
  };

  /* ----------------------------------------------------------- post-test */

  const alreadyCertified = Boolean(
    person &&
      course &&
      state.certificates.some(
        (c) => c.personId === person.id && c.courseId === course.id,
      ),
  );

  const takePost = (score: number) => {
    if (!course) return;
    update((s) => ({
      ...s,
      testResults: {
        ...s.testResults,
        [courseId]: { pre: s.testResults[courseId]?.pre ?? null, post: score },
      },
    }));
    logActivity("Completed post-test", course.title, `${score}%`);

    if (score < PASS_MARK) {
      notify(
        tt(
          `Post-test ${score}% — pass mark is ${PASS_MARK}%. Review and retake.`,
          `คะแนนหลังเรียน ${score}% เกณฑ์ผ่านคือ ${PASS_MARK}% กรุณาทบทวนแล้วทำใหม่`,
        ),
      );
      return;
    }

    if (!person || alreadyCertified) {
      notify(
        tt(
          `Post-test passed — ${score}%`,
          `ผ่านแบบทดสอบหลังเรียนแล้ว — ${score}%`,
        ),
      );
      return;
    }

    const issuedAt = new Date().toISOString().slice(0, 10);
    update((s) => {
      if (
        s.certificates.some(
          (c) => c.personId === person.id && c.courseId === course.id,
        )
      ) {
        return s;
      }
      return {
        ...s,
        certificates: [
          ...s.certificates,
          {
            id: `cert-${course.id}-${person.id}`,
            personId: person.id,
            courseId: course.id,
            courseTitle: course.title,
            issuedAt,
            score,
          },
        ],
      };
    });
    addPoints(person.id, LMS_POINTS.postTest);
    logActivity("Certificate issued", course.title, `${score}%`);
    pushNotification({
      audience: person.id,
      title: `Certificate issued — ${course.title}`,
      body: `You passed the post-test with ${score}%. Your certificate is available on the Achievements page.`,
      kind: "lms",
      channel: "Both",
      href: "/achievements",
    });
    // the certificate is the strongest evidence a development goal can carry
    announceGoals(courseTitle(course), "certificate");
    notify(
      tt(
        `Passed ${score}% — certificate issued, +${LMS_POINTS.postTest} points`,
        `ผ่าน ${score}% ระบบออกใบรับรองให้แล้ว +${LMS_POINTS.postTest} คะแนน`,
      ),
    );
  };

  /* -------------------------------------------------------------- render */

  if (!course) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.lms")} />
        <Card>
          <EmptyState
            title={tt("Course not found", "ไม่พบหลักสูตรนี้")}
            hint={tt(
              "It may have been removed from the catalogue.",
              "หลักสูตรนี้อาจถูกนำออกจากแคตตาล็อกแล้ว",
            )}
          />
          <div className="grid place-items-center pb-8">
            <Link href="/lms">
              <Button variant="outline">
                {tt("Back to catalogue", "กลับไปหน้าแคตตาล็อก")}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={courseTitle(course)} />
        <Card>
          <EmptyState
            title={tt("This course has no chapters yet", "หลักสูตรนี้ยังไม่มีบทเรียน")}
          />
        </Card>
      </div>
    );
  }

  const progress = Math.round((done.length / chapters.length) * 100);
  const chapterDone = done.includes(chapter.id);
  const nextChapter = chapters[chapterIndex + 1];
  const allDone = done.length === chapters.length;

  const backLink = (
    <button
      type="button"
      onClick={() => router.push("/lms")}
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
    >
      <ArrowLeft size={15} /> {tt("All courses", "หลักสูตรทั้งหมด")}
    </button>
  );

  /* ------------------------------------------------- pre-test gate screen */

  /* stay on the gate while the pre-test modal is open, so the learner sees the
     result panel before the player takes over */
  if (!preTestSettled || testOpen === "pre") {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        {backLink}
        <PageHeading title={t("nav.lms")} />
        <Card className="overflow-hidden">
          <div className={cn("h-2 w-full bg-gradient-to-r", course.cover)} />
          <div className="p-6 lg:p-8">
            <span className="grid size-12 place-items-center rounded-xl bg-brand-tint text-brand">
              <ClipboardList size={24} />
            </span>
            <h2 className="mt-4 text-2xl font-medium tracking-tight text-ink">
              {tt("Pre-test", "แบบทดสอบก่อนเรียน")} — {courseTitle(course)}
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm font-light text-muted">
              {tt(
                "Before chapter 1 opens, take a short multiple-choice pre-test. It records where you are starting from so the post-test can show how far you moved. You may skip it — the result panel will then show your baseline as unknown.",
                "ก่อนเปิดบทเรียนที่ 1 กรุณาทำแบบทดสอบก่อนเรียนแบบปรนัยสั้น ๆ เพื่อบันทึกจุดเริ่มต้นของคุณ แบบทดสอบหลังเรียนจะได้แสดงพัฒนาการได้ คุณสามารถข้ามได้ แต่ผลสรุปจะแสดงคะแนนตั้งต้นเป็นไม่ทราบ",
              )}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                {tt(
                  "Questions are generated from this course's chapters",
                  "คำถามถูกสร้างจากบทเรียนของหลักสูตรนี้",
                )}
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                {tt(
                  `Pass mark for the post-test is ${PASS_MARK}%`,
                  `เกณฑ์ผ่านของแบบทดสอบหลังเรียนคือ ${PASS_MARK}%`,
                )}
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                {tt(
                  "Passing the post-test issues your certificate automatically",
                  "เมื่อผ่านแบบทดสอบหลังเรียน ระบบจะออกใบรับรองให้อัตโนมัติ",
                )}
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setTestOpen("pre")}>
                <ClipboardCheck size={16} /> {tt("Start pre-test", "เริ่มทำแบบทดสอบก่อนเรียน")}
              </Button>
              <Button variant="outline" onClick={skipPre}>
                <SkipForward size={16} /> {tt("Skip pre-test", "ข้ามแบบทดสอบก่อนเรียน")}
              </Button>
            </div>
          </div>
        </Card>

        <CourseTestModal
          open={testOpen === "pre"}
          onClose={() => setTestOpen(null)}
          course={course}
          variant="pre"
          onSubmit={takePre}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------- player */

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      {backLink}

      <PageHeading
        title={t("nav.lms")}
        right={
          <div className="min-w-[200px]">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>{tt("Course progress", "ความคืบหน้าของหลักสูตร")}</span>
              <span className="font-bold text-ink">{progress}%</span>
            </div>
            <Progress value={progress} tone={progress >= 100 ? "success" : "brand"} />
          </div>
        }
      />

      {/* ---------------------------------------------------- content panel */}
      <div className="relative">
        <ChapterContent
          key={chapter.id}
          course={course}
          chapter={chapter}
          index={chapterIndex}
          complete={chapterDone}
          onComplete={() => completeChapter(chapter.id)}
        />

        {/* ------------------------------------------------- chapter list */}
        <div
          className={cn(
            "mt-4 rounded-xl bg-brand p-3 shadow-lg",
            // the Figma layout floats the list over the bottom-right of the dark
            // panel; an article chapter is a light card, so stack it instead
            chapterKind(chapter) !== "article" &&
              "lg:absolute lg:right-6 lg:top-full lg:z-10 lg:mt-0 lg:w-[340px] lg:-translate-y-8",
          )}
        >
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-white/70">
            {tt("Chapters", "บทเรียน")}
          </p>
          <ul className="space-y-2">
            {chapters.map((c, i) => {
              const active = c.id === chapter.id;
              const Icon = KIND_ICON[chapterKind(c)];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition-colors",
                      active
                        ? "border-2 border-accent bg-brand-dark"
                        : "border-2 border-transparent bg-brand-dark/70 hover:bg-brand-dark",
                    )}
                  >
                    <Icon size={14} className="shrink-0 text-white/80" />
                    <span className="min-w-0 flex-1">
                      {tt("Chapter", "บทที่")} {i + 1} | {chapterTitle(c)}
                    </span>
                    {done.includes(c.id) ? (
                      <Check size={15} className="shrink-0 text-white" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ---------------------------------------------------------- summary */}
      <div className="mt-6 lg:mt-8 lg:w-[62%]">
        <div className="flex gap-3">
          <span
            className="mt-1.5 size-0 shrink-0 border-x-[9px] border-t-[13px] border-x-transparent border-t-accent"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-bold text-ink">
              {lang === "th" ? chapter.summaryTh ?? chapter.summary : chapter.summary}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-light text-muted">
              {(lang === "th" && chapter.bulletsTh?.length
                ? chapter.bulletsTh
                : chapter.bullets
              ).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Pill tone={chapterDone ? "success" : "neutral"}>
            {chapterDone
              ? tt("Chapter complete", "เรียนจบบทนี้แล้ว")
              : tt("Not complete", "ยังไม่จบบทนี้")}
          </Pill>
          <KindBadge kind={chapterKind(chapter)} />
          <Pill tone="brand">{course.category}</Pill>
          <span className="text-xs text-muted">
            {tt(
              `${done.length} of ${chapters.length} chapters done`,
              `เรียนจบ ${done.length} จาก ${chapters.length} บท`,
            )}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------- post-test */}
      <section className="mt-8 lg:mt-10">
        <TestResultPanel
          pre={results?.pre ?? null}
          post={results?.post ?? null}
          onRetakePost={allDone ? () => setTestOpen("post") : undefined}
        />

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-ink">
                {tt("Post-test and certificate", "แบบทดสอบหลังเรียนและใบรับรอง")}
              </h3>
              <p className="mt-1 max-w-[62ch] text-xs text-muted">
                {allDone
                  ? tt(
                      `Finish with the post-test. Score ${PASS_MARK}% or more and the system issues your certificate automatically and awards ${LMS_POINTS.postTest} points.`,
                      `ปิดท้ายด้วยแบบทดสอบหลังเรียน หากได้ ${PASS_MARK}% ขึ้นไป ระบบจะออกใบรับรองให้อัตโนมัติพร้อมมอบ ${LMS_POINTS.postTest} คะแนน`,
                    )
                  : tt(
                      "The post-test unlocks once every chapter is complete.",
                      "แบบทดสอบหลังเรียนจะเปิดให้ทำเมื่อเรียนครบทุกบทแล้ว",
                    )}
              </p>
              {alreadyCertified ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <Award size={14} />
                  {tt(
                    "Certificate already issued for this course",
                    "ออกใบรับรองสำหรับหลักสูตรนี้ให้แล้ว",
                  )}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!allDone} onClick={() => setTestOpen("post")}>
                <ClipboardCheck size={16} />
                {results?.post != null
                  ? tt("Retake post-test", "ทำแบบทดสอบหลังเรียนอีกครั้ง")
                  : tt("Take post-test", "ทำแบบทดสอบหลังเรียน")}
              </Button>
              {alreadyCertified ? (
                <Link href="/achievements">
                  <Button variant="outline">
                    <Award size={16} /> {tt("View certificate", "ดูใบรับรอง")}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      {/* --------------------------------------------------------- ask AI */}
      <div className="mt-8 lg:mt-10">
        <AiStudyPanel course={course} chapter={chapter} />
      </div>

      {/* --------------------------------------------------------- footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => {
            const prev = chapters[chapterIndex - 1];
            if (prev) setActiveId(prev.id);
          }}
          disabled={chapterIndex <= 0}
        >
          <ArrowLeft size={16} /> {tt("Previous chapter", "บทก่อนหน้า")}
        </Button>

        <div className="flex flex-wrap gap-3">
          {chapterDone ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 size={16} /> {tt("Chapter complete", "เรียนจบบทนี้แล้ว")}
            </span>
          ) : (
            <Button onClick={() => completeChapter(chapter.id)}>
              <Check size={16} /> {tt("Mark chapter complete", "ทำเครื่องหมายว่าเรียนจบบทนี้")}
            </Button>
          )}
          {nextChapter ? (
            <Button
              variant={chapterDone ? "primary" : "outline"}
              onClick={() => setActiveId(nextChapter.id)}
            >
              {tt("Next chapter", "บทถัดไป")}
            </Button>
          ) : (
            <Link href="/lms">
              <Button variant="outline">
                {tt("Back to catalogue", "กลับไปหน้าแคตตาล็อก")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <CourseTestModal
        open={testOpen === "post"}
        onClose={() => setTestOpen(null)}
        course={course}
        variant="post"
        onSubmit={takePost}
      />
    </div>
  );
}
