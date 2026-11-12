"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  MessageSquare,
  Paperclip,
  Play,
  PlayCircle,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  PageHeading,
  Pill,
  Progress,
} from "@/components/ui";
import {
  FALLBACK_COVER,
  categoryDictKey,
  pick,
  type CourseCategory,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import type { CertificateOption, IdpGoalView, ResumeCourse } from "@/server/learning";
import { GoalEvidencePanel } from "./GoalEvidence";
import { GoalTimeline, StatusPill, useStatusLabel } from "./GoalTimeline";
import { daysLeft, goalStatus, parseDate, type GoalStatus } from "./status";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const ACTIVITY_LABEL: Record<
  IdpGoalView["activity"],
  { en: string; th: string }
> = {
  ONLINE_COURSE: { en: "Online course", th: "เรียนออนไลน์" },
  COACHING: { en: "Coaching", th: "โค้ชชิ่ง" },
  ON_THE_JOB: { en: "On-the-job training", th: "ฝึกจากงานจริง" },
};

/**
 * The Individual Development Plan, rendered from the database.
 *
 * Every percentage on the screen — the summary, the timeline, each card, the
 * course list in a goal's details — is the number the server derived from this
 * person's chapter completions. Nothing is recomputed here and nothing is
 * stored: finishing a course in the LMS on a phone moves this screen on a
 * laptop, because both are reading the same `ChapterProgress` rows.
 *
 * Goals come from the manager (Team Profile) and, automatically, from the
 * courses the assessment assigned (`syncAssignedGoals`); the owner does not
 * add, edit or delete goals (the product owner's decision: the system decides
 * what to study, from the position and career track). The learning evidence
 * panel is the only write this screen makes.
 */
export function IdpView({
  goals,
  certificates,
  resume,
}: {
  goals: IdpGoalView[];
  certificates: CertificateOption[];
  /** kept for callers; the plan is one list now, so groups are labels on cards */
  assessedGroups?: CourseCategory[];
  /** the course studied most recently, chosen on the server */
  resume: ResumeCourse | null;
}) {
  const { t, tt, lang } = useT();
  // the manager's stamp is "Assigned by NAME — note"; show the stamp in the
  // reader's language and the manager's own words as written
  const remarkText = (remark: string) => {
    const m = /^Assigned by (.+?)(?: — ([\s\S]*))?$/.exec(remark);
    if (!m) return remark;
    const stamp = tt(`Assigned by ${m[1]}`, `มอบหมายโดย ${m[1]}`);
    return m[2] ? `${stamp} — ${m[2]}` : stamp;
  };
  const router = useRouter();

  /** the goal whose details (evidence, other courses) are open */
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const details = goals.find((g) => g.id === detailsId) ?? null;
  const statusLabel = useStatusLabel();

  const goalName = (g: IdpGoalView) =>
    pick(lang, g.competencyNameEn, g.competencyNameTh);

  const groupLabel = (g: CourseCategory) => t(categoryDictKey(g));

  /* ------------------------------------------------- overall plan stats */
  const stats = useMemo(() => {
    const now = Date.now();
    const acc = { complete: 0, onTrack: 0, atRisk: 0, overdue: 0 };
    goals.forEach((g) => (acc[goalStatus(g, now)] += 1));
    const avg = goals.length
      ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length)
      : 0;
    return { ...acc, avg };
  }, [goals]);

  /* The open goals, most urgent first: overdue, at risk, on track, then by
     due date. One list, no tabs or pagers, so nothing on the page changes
     height while it is being read; the details open in a dialog. */
  const URGENCY: Record<string, number> = { overdue: 0, atRisk: 1, onTrack: 2, complete: 3 };
  const open = useMemo(
    () =>
      goals
        .filter((g) => !g.complete)
        .map((g) => ({ g, status: goalStatus(g) }))
        .sort(
          (a, b) =>
            URGENCY[a.status]! - URGENCY[b.status]! || a.g.dueDate.localeCompare(b.g.dueDate),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals],
  );
  const finished = goals.filter((g) => g.complete);

  const timelineGoals = useMemo(
    () =>
      goals.map((g) => ({
        id: g.id,
        startDate: g.startDate,
        dueDate: g.dueDate,
        progress: g.progress,
        name: goalName(g),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, lang],
  );

  const dateFmt = (iso: string) =>
    new Date(parseDate(iso)).toLocaleDateString(
      lang === "th" ? "th-TH" : "en-GB",
      { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" },
    );

  /** the goal's own course, when it has one */
  const planCourse = (g: IdpGoalView) => g.courses.find((c) => c.inPlan) ?? null;

  /** One goal: every line is a single truncated line, so all cards match. */
  const goalCard = (g: IdpGoalView, status: GoalStatus) => {
    const name = goalName(g);
    const course = planCourse(g);
    const left = daysLeft(g);
    const overdue = status === "overdue";
    const action = course
      ? {
          label:
            g.progress >= 100
              ? tt("Review course", "ทบทวนหลักสูตร")
              : g.progress > 0
                ? t("action.continue")
                : tt("Start course", "เริ่มเรียน"),
          go: () => router.push(`/lms/${course.slug}`),
        }
      : { label: tt("Add evidence", "แนบหลักฐาน"), go: () => setDetailsId(g.id) };
    return (
      <Card key={g.id} id={`goal-${g.id}`} className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">
            {groupLabel(g.group)}
          </span>
          <StatusPill status={status} />
        </div>
        <h3 className="mt-1.5 truncate text-base font-bold text-ink" title={name}>
          {name}
        </h3>
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-tint px-2 py-0.5 font-medium text-brand">
            <Target size={12} className="shrink-0" />
            {tt(`Level ${g.fromLevel} → ${g.toLevel}`, `ระดับ ${g.fromLevel} → ${g.toLevel}`)}
          </span>
          <span className="truncate text-muted">
            {g.fromAssessment
              ? tt("Assigned from your assessment", "มอบหมายจากผลการประเมิน")
              : pick(lang, ACTIVITY_LABEL[g.activity].en, ACTIVITY_LABEL[g.activity].th)}
          </span>
        </div>

        <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm text-ink">
          <BookOpen size={14} className="shrink-0 text-muted" />
          <span className="truncate">
            {course
              ? pick(lang, course.titleEn, course.titleTh)
              : pick(lang, ACTIVITY_LABEL[g.activity].en, ACTIVITY_LABEL[g.activity].th)}
          </span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Progress className="flex-1" tone={g.progress >= 100 ? "success" : overdue ? "amber" : "brand"} value={g.progress} />
          <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-ink">{g.progress}%</span>
        </div>
        <p className={cn("mt-2 flex items-center gap-1.5 text-xs", overdue ? "font-medium text-accent" : "text-muted")}>
          <CalendarDays size={13} className="shrink-0" />
          <span className="truncate">
            {tt(`Due ${dateFmt(g.dueDate)}`, `ครบกำหนด ${dateFmt(g.dueDate)}`)}
            {status === "complete"
              ? ""
              : overdue
                ? tt(` · ${-left} days overdue`, ` · เลยกำหนด ${-left} วัน`)
                : tt(` · ${left} days left`, ` · เหลือ ${left} วัน`)}
          </span>
        </p>

        <div className="mt-auto flex gap-2 pt-4">
          <Button className="min-w-0 flex-1" onClick={action.go}>
            {course ? <Play size={14} /> : <Paperclip size={14} />}
            <span className="truncate">{action.label}</span>
          </Button>
          <Button variant="outline" onClick={() => setDetailsId(g.id)} aria-label={tt(`Details of ${name}`, `รายละเอียด ${name}`)}>
            {tt("Details", "รายละเอียด")}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Individual Development Plan", "แผนพัฒนารายบุคคล")}
        subtitle={tt(
          "Every goal closes a competency gap by a target date",
          "ทุกเป้าหมายคือการปิดช่องว่างสมรรถนะภายในกำหนดเวลา",
        )}
        right={
          <Button variant="outline" onClick={() => router.push("/reports")}>
            {tt("View full report", "ดูรายงานฉบับเต็ม")}
          </Button>
        }
      />

      {/* ------------------------------------------------ resume latest class */}
      {resume ? <ResumeCard resume={resume} /> : null}

      {/* --------------------------------------------------- plan summary */}
      {/* one strip rather than four tiles: the plan at a glance, short on a phone */}
      <Card className="mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-ink">
              {tt("Plan progress", "ความคืบหน้าของแผน")}
            </p>
            <p className="text-2xl font-bold tabular-nums text-brand">{stats.avg}%</p>
          </div>
          <Progress className="mt-2" tone="brand" value={stats.avg} />
        </div>
        <dl className="grid grid-cols-4 gap-1.5 text-center sm:w-auto sm:gap-3">
          {(
            [
              ["onTrack", stats.onTrack, "text-brand"],
              ["atRisk", stats.atRisk, "text-amber"],
              ["overdue", stats.overdue, "text-accent"],
              ["complete", stats.complete, "text-success"],
            ] as const
          ).map(([key, n, tone]) => (
            <div key={key} className="flex min-w-0 flex-col-reverse rounded-lg bg-surface px-1 py-2 sm:min-w-20 sm:px-2">
              <dt className="truncate text-[11px] text-muted">{statusLabel(key)}</dt>
              <dd className={cn("text-xl font-bold tabular-nums", tone)}>{n}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ------------------------------------------------------- goal list */}
      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink lg:text-2xl">
            {tt("In progress", "กำลังดำเนินการ")}{" "}
            <span className="text-base font-medium text-muted">({open.length})</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {tt("Most urgent first", "เรียงจากเร่งด่วนที่สุด")}
          </p>
        </div>
      </div>

      {open.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {open.map(({ g, status }) => goalCard(g, status))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={
              goals.length === 0
                ? tt("No development goals yet", "ยังไม่มีเป้าหมายการพัฒนา")
                : tt("Every goal is complete", "ทุกเป้าหมายเสร็จสิ้นแล้ว")
            }
            hint={
              goals.length === 0
                ? tt(
                    "Your goals are set for you. Courses are assigned from your assessment: where your supervisor's score is below the level your position and career role expect, the courses in between are added here. Your supervisor can also set goals.",
                    "เป้าหมายถูกกำหนดให้คุณ คอร์สมอบหมายจากผลประเมิน: สมรรถนะที่หัวหน้าให้คะแนนต่ำกว่าระดับที่ตำแหน่งและสายงานของคุณคาดหวัง ระบบจะเพิ่มคอร์สที่ต้องเรียนไว้ที่นี่ หัวหน้าก็กำหนดเป้าหมายเพิ่มได้",
                  )
                : tt(
                    "Finished goals are listed below.",
                    "เป้าหมายที่เสร็จแล้วแสดงอยู่ด้านล่าง",
                  )
            }
          />
        </Card>
      )}

      {/* ------------------------------------------------------ completed */}
      {finished.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-ink lg:text-2xl">
            {tt("Completed", "เสร็จสิ้นแล้ว")}{" "}
            <span className="text-base font-medium text-muted">({finished.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finished.map((g) => goalCard(g, "complete"))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- timeline */}
      {goals.length ? (
        <Card className="mt-8">
          <CardHeader
            title={tt("Development timeline", "ไทม์ไลน์การพัฒนา")}
            subtitle={tt("Each bar is a goal's time frame; the filled part is its progress",
              "แต่ละแท่งคือช่วงเวลาของเป้าหมาย ส่วนที่ทึบคือความคืบหน้า",
            )}
          />
          <div className="px-5 pb-5">
            <GoalTimeline goals={timelineGoals} onSelect={setDetailsId} />
          </div>
        </Card>
      ) : null}

      {/* ---------------------------------------------------- goal details */}
      <Modal
        open={details != null}
        onClose={() => setDetailsId(null)}
        width="max-w-2xl"
        title={details ? goalName(details) : ""}
        subtitle={
          details
            ? tt(
                `Level ${details.fromLevel} → ${details.toLevel} · ${dateFmt(details.startDate)} – ${dateFmt(details.dueDate)}`,
                `ระดับ ${details.fromLevel} → ${details.toLevel} · ${dateFmt(details.startDate)} – ${dateFmt(details.dueDate)}`,
              )
            : undefined
        }
        footer={
          <Button variant="outline" onClick={() => setDetailsId(null)}>
            {t("action.close")}
          </Button>
        }
      >
        {details ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={goalStatus(details)} />
              <Pill tone="neutral">
                {pick(lang, ACTIVITY_LABEL[details.activity].en, ACTIVITY_LABEL[details.activity].th)}
              </Pill>
              <Pill tone="neutral">{groupLabel(details.group)}</Pill>
            </div>

            {details.fromAssessment ? (
              <p className="flex items-start gap-2 rounded-lg bg-brand-tint px-3 py-2 text-xs text-brand">
                <Target size={13} className="mt-0.5 shrink-0" />
                <span>
                  {tt(
                    "Assigned from your assessment: your score is below what your position expects, so this course was added to your plan automatically.",
                    "มอบหมายจากผลการประเมิน: คะแนนของคุณต่ำกว่าที่ตำแหน่งคาดหวัง ระบบจึงเพิ่มคอร์สนี้ในแผนของคุณโดยอัตโนมัติ",
                  )}
                </span>
              </p>
            ) : details.remark ? (
              <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
                <MessageSquare size={13} className="mt-0.5 shrink-0" />
                <span>{remarkText(details.remark)}</span>
              </p>
            ) : null}

            {/* the plan's course first, then the others that build this competency */}
            {details.courses.length ? (
              <div>
                <p className="mb-2 text-xs font-bold text-ink">
                  {tt("Courses for this competency", "หลักสูตรสำหรับสมรรถนะนี้")}
                </p>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {details.courses.map((c) => {
                    const p = c.inPlan ? details.progress : c.progress;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/lms/${c.slug}`}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {pick(lang, c.titleEn, c.titleTh)}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {c.chapterCount} {tt("lessons", "บทเรียน")} · {c.hours}
                              {tt("h", " ชม.")}
                              {c.inPlan ? " · " + tt("in your plan", "อยู่ในแผนของคุณ") : ""}
                              {c.assigned ? " · " + tt("assigned", "ได้รับมอบหมาย") : ""}
                            </span>
                          </span>
                          <Progress className="w-16 shrink-0 sm:w-24" tone={p >= 100 ? "success" : "brand"} value={p} />
                          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{p}%</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {details.courseId ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <RefreshCw size={12} className="shrink-0" />
                    {tt("Finishing the course in your plan completes this goal",
                      "เรียนหลักสูตรในแผนจบแล้ว เป้าหมายนี้จะเสร็จเอง",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            <GoalEvidencePanel
              goalId={details.id}
              goalName={goalName(details)}
              planCourseId={details.courseId}
              items={details.evidence}
              certificates={certificates}
            />
          </div>
        ) : null}
      </Modal>

    </div>
  );
}

/**
 * "Pick up where you left off": the course this person studied last (chosen
 * on the server, `getResumeCourse`), drawn with the same cover as its
 * catalogue card, and the next chapter to open.
 */
function ResumeCard({ resume }: { resume: ResumeCourse }) {
  const { t, tt, lang } = useT();
  const title = pick(lang, resume.titleEn, resume.titleTh);
  const href = resume.next ? `/lms/${resume.slug}?chapter=${resume.next.id}` : `/lms/${resume.slug}`;
  return (
    <section className="mt-2" aria-label={tt("Pick up where you left off", "เรียนต่อจากที่ค้างไว้")}>
      <Card className="grid overflow-hidden sm:grid-cols-[minmax(0,260px)_1fr]">
        <Link
          href={href}
          aria-label={tt(`Open ${resume.titleEn}`, `เปิดหลักสูตร ${title}`)}
          className={cn(
            "grid h-32 place-items-center bg-gradient-to-br text-white/90 transition-opacity hover:opacity-95 sm:h-full sm:min-h-44",
            resume.cover ?? FALLBACK_COVER,
          )}
        >
          <PlayCircle size={44} strokeWidth={1.5} />
        </Link>
        <div className="flex min-w-0 flex-col p-5">
          <p className="text-xs font-medium text-muted">
            {tt("Pick up where you left off", "เรียนต่อจากที่ค้างไว้")}
          </p>
          <h2 className="mt-1 truncate text-lg font-bold text-ink lg:text-xl" title={title}>
            {title}
          </h2>
          <p className="mt-1 truncate text-sm text-ink">
            {resume.next
              ? tt(
                  `Next: chapter ${resume.next.number} · ${resume.next.titleEn}`,
                  `ถัดไป: บทที่ ${resume.next.number} · ${pick(lang, resume.next.titleEn, resume.next.titleTh)}`,
                )
              : tt("Every chapter done — take the post-test or review", "เรียนครบทุกบทแล้ว — ทำแบบทดสอบหลังเรียนหรือทบทวน")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Progress className="flex-1" tone={resume.complete ? "success" : "brand"} value={resume.progress} />
            <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-ink">{resume.progress}%</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {tt(
              `${resume.doneCount} of ${resume.chapterCount} chapters · ${resume.hours}h`,
              `${resume.doneCount} จาก ${resume.chapterCount} บท · ${resume.hours} ชม.`,
            )}
          </p>
          <div className="mt-auto pt-4">
            <Link href={href} className="block sm:inline-block">
              <Button className="w-full sm:w-auto sm:min-w-40">
                <Play size={14} />
                {resume.complete ? tt("Review course", "ทบทวนหลักสูตร") : t("action.continue")}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
