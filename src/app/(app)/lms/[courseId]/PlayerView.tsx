"use client";

import { Suspense, useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { Button, Card, PageHeading, Pill, Progress } from "@/components/ui";
import { AiStudyPanel } from "@/components/learning/AiStudyPanel";
import {
  ChapterContent,
  KIND_ICON,
  KindBadge,
} from "@/components/learning/ChapterContent";
import {
  CourseTestModal,
  TestResultPanel,
} from "@/components/learning/CourseTest";
import type { TestVariant } from "@/components/learning/testEngine";
import {
  FALLBACK_COVER,
  LMS_POINTS,
  PASS_MARK,
  categoryDictKey,
  pick,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PlayerView as PlayerData } from "@/server/learning";
import {
  completeChapterAction,
  recordTestAction,
  skipPreTestAction,
  type LmsError,
} from "../actions";

export function PlayerView({ view }: { view: PlayerData }) {
  return (
    <Suspense fallback={<PlayerFallback />}>
      <Player view={view} />
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

/**
 * The Figma course player, reading and writing Postgres.
 *
 * Chapter completion, the two tests and the certificate are all server actions;
 * this component holds nothing but which chapter is open and which modal is up.
 * A chapter the learner just finished is shown as done immediately and then
 * confirmed by `router.refresh()`, so the optimistic tick and the database
 * agree within one round trip rather than diverging the way a `localStorage`
 * copy used to.
 */
function Player({ view }: { view: PlayerData }) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const courseTitle = pick(lang, view.titleEn, view.titleTh);
  const chapters = view.chapters;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState<TestVariant | null>(null);
  /** chapters this visit finished, so the tick does not wait for the refresh */
  const [justDone, setJustDone] = useState<string[]>([]);
  /** the pre-test gate is skippable for this visit without inventing a score */
  const [skippedPre, setSkippedPre] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<LmsError | null>(null);

  const isDone = useCallback(
    (id: string) => justDone.includes(id) || Boolean(chapters.find((c) => c.id === id)?.done),
    [justDone, chapters],
  );

  const doneCount = chapters.filter((c) => isDone(c.id)).length;
  const progress = chapters.length
    ? Math.round((doneCount / chapters.length) * 100)
    : 0;
  const allDone = chapters.length > 0 && doneCount === chapters.length;

  const wanted = search?.get("chapter");
  const chapter =
    chapters.find((c) => c.id === activeId) ??
    (wanted ? chapters.find((c) => c.id === wanted) : undefined) ??
    chapters[0];
  const chapterIndex = chapter
    ? chapters.findIndex((c) => c.id === chapter.id)
    : -1;
  const chapterDone = chapter ? isDone(chapter.id) : false;
  const nextChapter = chapters[chapterIndex + 1];

  const testSource = useMemo(
    () => ({ courseId: view.courseId, chapters: view.chapters }),
    [view.courseId, view.chapters],
  );

  const errorText = (code: LmsError) =>
    ({
      not_authorised: tt(
        "Sign in again to record your progress.",
        "กรุณาเข้าสู่ระบบอีกครั้งเพื่อบันทึกความคืบหน้า",
      ),
      invalid: tt("That could not be recorded.", "ไม่สามารถบันทึกรายการนี้ได้"),
      not_found: tt(
        "This course is no longer published.",
        "หลักสูตรนี้ไม่ได้เผยแพร่แล้ว",
      ),
      not_complete: tt(
        "Finish every chapter before taking the post-test.",
        "กรุณาเรียนให้ครบทุกบทก่อนทำแบบทดสอบหลังเรียน",
      ),
    })[code];

  /* ----------------------------------------------------- chapter progress */

  const completeChapter = useCallback(
    (chapterId: string) => {
      if (isDone(chapterId) || pending) return;
      setError(null);
      startTransition(async () => {
        const result = await completeChapterAction({
          slug: view.slug,
          chapterId,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setJustDone((prev) =>
          prev.includes(chapterId) ? prev : [...prev, chapterId],
        );
        const data = result.data;
        if (data.courseComplete) {
          const goal = data.goals[0];
          setMessage(
            goal
              ? tt(
                  `Course complete${data.pointsAwarded ? ` +${data.pointsAwarded} points` : ""} — your development goal “${goal.nameEn}” is now done`,
                  `เรียนจบหลักสูตร${data.pointsAwarded ? ` +${data.pointsAwarded} คะแนน` : ""} เป้าหมายพัฒนา “${goal.nameTh ?? goal.nameEn}” เสร็จสิ้นแล้ว`,
                )
              : tt(
                  `Course complete${data.pointsAwarded ? ` +${data.pointsAwarded} points` : ""} — take the post-test to earn your certificate`,
                  `เรียนจบหลักสูตร${data.pointsAwarded ? ` +${data.pointsAwarded} คะแนน` : ""} ทำแบบทดสอบหลังเรียนเพื่อรับใบรับรอง`,
                ),
          );
        } else {
          setMessage(
            tt(
              `Chapter complete — ${data.progress}% of ${courseTitle}`,
              `เรียนจบบทเรียน — ${data.progress}% ของ ${courseTitle}`,
            ),
          );
        }
        router.refresh();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDone, pending, view.slug, courseTitle, tt, router],
  );

  /* ------------------------------------------------------------ the tests */

  const submitTest = (variant: TestVariant, score: number) => {
    setError(null);
    startTransition(async () => {
      const result = await recordTestAction({
        slug: view.slug,
        kind: variant === "pre" ? "PRE" : "POST",
        score,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const data = result.data;
      if (variant === "pre") {
        setMessage(
          tt(
            `Pre-test recorded — ${score}%`,
            `บันทึกคะแนนก่อนเรียนแล้ว — ${score}%`,
          ),
        );
      } else if (!data.passed) {
        setMessage(
          tt(
            `Post-test ${score}% — pass mark is ${PASS_MARK}%. Review and retake.`,
            `คะแนนหลังเรียน ${score}% เกณฑ์ผ่านคือ ${PASS_MARK}% กรุณาทบทวนแล้วทำใหม่`,
          ),
        );
      } else if (data.certificateIssued) {
        setMessage(
          tt(
            `Passed ${score}% — certificate ${data.certificateCode} issued${data.pointsAwarded ? `, +${data.pointsAwarded} points` : ""}`,
            `ผ่าน ${score}% ระบบออกใบรับรองเลขที่ ${data.certificateCode} ให้แล้ว${data.pointsAwarded ? ` +${data.pointsAwarded} คะแนน` : ""}`,
          ),
        );
      } else {
        setMessage(
          tt(
            `Post-test passed — ${score}%. Your certificate was already issued.`,
            `ผ่านแบบทดสอบหลังเรียนแล้ว — ${score}% ระบบเคยออกใบรับรองให้คุณไปแล้ว`,
          ),
        );
      }
      router.refresh();
    });
  };

  const skipPre = () => {
    setSkippedPre(true);
    setMessage(
      tt(
        "Pre-test skipped — your baseline will show as unknown",
        "ข้ามแบบทดสอบก่อนเรียน คะแนนตั้งต้นจะแสดงเป็นไม่ทราบ",
      ),
    );
    startTransition(async () => {
      await skipPreTestAction({ slug: view.slug });
    });
  };

  /* -------------------------------------------------------------- render */

  const backLink = (
    <Link
      href="/lms"
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
    >
      <ArrowLeft size={15} /> {tt("All courses", "หลักสูตรทั้งหมด")}
    </Link>
  );

  const banner =
    error !== null ? (
      <p className="mb-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm text-accent">
        {errorText(error)}
      </p>
    ) : message ? (
      <p className="mb-4 rounded-lg border border-brand/30 bg-brand-tint px-4 py-2.5 text-sm text-brand">
        {message}
      </p>
    ) : null;

  if (!chapter) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        {backLink}
        <PageHeading title={courseTitle} />
        <Card className="p-8 text-center text-sm text-muted">
          {tt("This course has no chapters yet", "หลักสูตรนี้ยังไม่มีบทเรียน")}
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------- pre-test gate screen */

  /* The gate stands until the learner has a pre-test score, has skipped it for
     this visit, or has already started the course. Skipping writes no
     `TestResult`: there is no such thing as a score of "unknown". */
  const settled = view.preScore !== null || skippedPre || progress > 0;
  if (!settled || testOpen === "pre") {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        {backLink}
        <PageHeading title={t("nav.lms")} />
        {banner}
        <Card className="overflow-hidden">
          <div
            className={cn(
              "h-2 w-full bg-gradient-to-r",
              view.cover ?? FALLBACK_COVER,
            )}
          />
          <div className="p-6 lg:p-8">
            <span className="grid size-12 place-items-center rounded-xl bg-brand-tint text-brand">
              <ClipboardList size={24} />
            </span>
            <h2 className="mt-4 text-2xl font-medium tracking-tight text-ink">
              {tt("Pre-test", "แบบทดสอบก่อนเรียน")} — {courseTitle}
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
                <ClipboardCheck size={16} />{" "}
                {tt("Start pre-test", "เริ่มทำแบบทดสอบก่อนเรียน")}
              </Button>
              <Button variant="outline" onClick={skipPre} disabled={pending}>
                <SkipForward size={16} />{" "}
                {tt("Skip pre-test", "ข้ามแบบทดสอบก่อนเรียน")}
              </Button>
            </div>
          </div>
        </Card>

        <CourseTestModal
          open={testOpen === "pre"}
          onClose={() => setTestOpen(null)}
          title={courseTitle}
          source={testSource}
          variant="pre"
          pending={pending}
          onSubmit={(score) => submitTest("pre", score)}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------- player */

  const summary = pick(
    lang,
    chapter.summaryEn ?? chapter.titleEn,
    chapter.summaryTh,
  );
  const bullets =
    lang === "th" && chapter.bulletsTh.length
      ? chapter.bulletsTh
      : chapter.bulletsEn;

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
            <Progress
              value={progress}
              tone={progress >= 100 ? "success" : "brand"}
            />
          </div>
        }
      />

      {banner}

      {/* ---------------------------------------------------- content panel */}
      <div className="relative">
        <ChapterContent
          key={chapter.id}
          course={view}
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
            chapter.kind !== "ARTICLE" &&
              "lg:absolute lg:right-6 lg:top-full lg:z-10 lg:mt-0 lg:w-[340px] lg:-translate-y-8",
          )}
        >
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-white/70">
            {tt("Chapters", "บทเรียน")}
          </p>
          <ul className="space-y-2">
            {chapters.map((c, i) => {
              const active = c.id === chapter.id;
              const Icon = KIND_ICON[c.kind];
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
                      {tt("Chapter", "บทที่")} {i + 1} |{" "}
                      {pick(lang, c.titleEn, c.titleTh)}
                    </span>
                    {isDone(c.id) ? (
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
            <p className="font-bold text-ink">{summary}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-light text-muted">
              {bullets.map((b) => (
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
          <KindBadge kind={chapter.kind} />
          <Pill tone="brand">{t(categoryDictKey(view.category))}</Pill>
          <span className="text-xs text-muted">
            {tt(
              `${doneCount} of ${chapters.length} chapters done`,
              `เรียนจบ ${doneCount} จาก ${chapters.length} บท`,
            )}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------- linked IDP goals */}
      {view.goals.length ? (
        <Card className="mt-6 p-4">
          <p className="text-sm font-bold text-ink">
            {tt(
              "This course is in your development plan",
              "หลักสูตรนี้อยู่ในแผนพัฒนาของคุณ",
            )}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {view.goals.map((g) => (
              <li key={g.id}>
                {tt(
                  `${g.competencyNameEn}: level ${g.fromLevel} → ${g.toLevel}`,
                  `${g.competencyNameTh ?? g.competencyNameEn}: ระดับ ${g.fromLevel} → ${g.toLevel}`,
                )}
                {progress >= 100
                  ? ` · ${tt("goal complete", "เป้าหมายเสร็จสิ้น")}`
                  : ` · ${progress}%`}
              </li>
            ))}
          </ul>
          <Link href="/idp" className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              {tt("Open your plan", "เปิดแผนพัฒนาของคุณ")}
            </Button>
          </Link>
        </Card>
      ) : null}

      {/* -------------------------------------------------------- post-test */}
      <section className="mt-8 lg:mt-10">
        <TestResultPanel
          pre={view.preScore}
          post={view.postScore}
          onRetakePost={allDone ? () => setTestOpen("post") : undefined}
        />

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-ink">
                {tt(
                  "Post-test and certificate",
                  "แบบทดสอบหลังเรียนและใบรับรอง",
                )}
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
              {view.certificate ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <Award size={14} />
                  {tt(
                    `Certificate ${view.certificate.code} already issued for this course`,
                    `ออกใบรับรองเลขที่ ${view.certificate.code} สำหรับหลักสูตรนี้ให้แล้ว`,
                  )}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!allDone || pending}
                onClick={() => setTestOpen("post")}
              >
                <ClipboardCheck size={16} />
                {view.postScore !== null
                  ? tt("Retake post-test", "ทำแบบทดสอบหลังเรียนอีกครั้ง")
                  : tt("Take post-test", "ทำแบบทดสอบหลังเรียน")}
              </Button>
              {view.certificate ? (
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
        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          <Sparkles size={12} /> {tt("Scripted demo", "ผู้ช่วยแบบสคริปต์")}
        </p>
        <AiStudyPanel course={view} chapter={chapter} />
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
              <CheckCircle2 size={16} />{" "}
              {tt("Chapter complete", "เรียนจบบทนี้แล้ว")}
            </span>
          ) : (
            <Button
              disabled={pending}
              onClick={() => completeChapter(chapter.id)}
            >
              <Check size={16} />{" "}
              {tt("Mark chapter complete", "ทำเครื่องหมายว่าเรียนจบบทนี้")}
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
        title={courseTitle}
        source={testSource}
        variant="post"
        pending={pending}
        onSubmit={(score) => submitTest("post", score)}
      />
    </div>
  );
}
