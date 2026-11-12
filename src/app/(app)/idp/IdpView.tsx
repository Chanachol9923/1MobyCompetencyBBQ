"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  Tabs,
} from "@/components/ui";
import {
  FALLBACK_COVER,
  categoryDictKey,
  pick,
  type CourseCategory,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import type {
  CertificateOption,
  IdpCompetency,
  IdpGoalView,
  ResumeCourse,
} from "@/server/learning";
import { verdictFor } from "@/components/profile/gap";
import { GoalEvidencePanel } from "./GoalEvidence";
import { GoalTimeline, StatusPill, useStatusLabel } from "./GoalTimeline";
import { daysLeft, goalStatus, parseDate } from "./status";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const GROUP_ORDER: CourseCategory[] = ["CORE", "FUNCTIONAL", "MANAGERIAL"];

/** A row of the plan: an assessed competency, or (expected null) one that only
 *  a goal brought in. */
type RowCompetency = Omit<IdpCompetency, "expected"> & { expected: number | null };

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
  assessedGroups = [],
  competencies = [],
}: {
  goals: IdpGoalView[];
  certificates: CertificateOption[];
  /** the competency groups this person's role is assessed on: the tabs */
  assessedGroups?: CourseCategory[];
  /** every competency they are assessed on, goal or not: one row each */
  competencies?: IdpCompetency[];
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

  /* The plan reads by competency group (tabs), and inside a group by
     competency: one row for every competency this person is assessed on
     (their position's functional set, their career role's expected levels),
     with its goals or, without one, a line saying where it stands. A goal on a
     competency outside that set still gets a row, so no goal is hidden. */
  const URGENCY: Record<string, number> = { overdue: 0, atRisk: 1, onTrack: 2, complete: 3 };
  const goalsOf = (competencyId: string) =>
    goals
      .filter((g) => g.competencyId === competencyId)
      .map((g) => ({ g, rank: URGENCY[goalStatus(g)]! }))
      .sort((a, b) => a.rank - b.rank || a.g.dueDate.localeCompare(b.g.dueDate))
      .map(({ g }) => g);
  const rows = useMemo(() => {
    const out: RowCompetency[] = [...competencies];
    for (const g of goals) {
      if (out.some((r) => r.competencyId === g.competencyId)) continue;
      out.push({
        competencyId: g.competencyId,
        group: g.group,
        nameEn: g.competencyNameEn,
        nameTh: g.competencyNameTh,
        expected: null,
        manager: null,
        self: null,
      });
    }
    return out;
  }, [competencies, goals]);
  const groups = GROUP_ORDER.filter(
    (gr) => assessedGroups.includes(gr) || rows.some((r) => r.group === gr),
  );
  const [group, setGroup] = useState<CourseCategory | null>(null);
  const activeGroup =
    group && groups.includes(group)
      ? group
      : (groups.find((gr) => goals.some((g) => g.group === gr && !g.complete)) ?? groups[0] ?? "CORE");

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

  /** One goal inside its competency's row, in the plan's original look. */
  const goalBlock = (g: IdpGoalView) => {
    const status = goalStatus(g);
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
      <div key={g.id} id={`goal-${g.id}`} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-1.5 font-medium text-brand">
            <Target size={14} className="shrink-0" />
            {tt(`Level ${g.fromLevel} → ${g.toLevel}`, `ระดับ ${g.fromLevel} → ${g.toLevel}`)}
          </span>
          <StatusPill status={status} />
          {g.fromAssessment ? (
            <span className="text-xs font-medium text-brand">
              {tt("Assigned from your assessment", "มอบหมายจากผลการประเมิน")}
            </span>
          ) : null}
          <span className={cn("inline-flex items-center gap-1.5 text-xs", overdue ? "font-medium text-accent" : "text-muted")}>
            <CalendarDays size={14} className="shrink-0" />
            {tt(`Due ${dateFmt(g.dueDate)}`, `ครบกำหนด ${dateFmt(g.dueDate)}`)}
            {status === "complete"
              ? ""
              : overdue
                ? tt(` · ${-left} days overdue`, ` · เลยกำหนด ${-left} วัน`)
                : tt(` · ${left} days left`, ` · เหลือ ${left} วัน`)}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg bg-surface px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="min-w-0 sm:w-56 sm:shrink-0">
              <span className="block truncate text-sm font-bold text-ink">
                {course
                  ? pick(lang, course.titleEn, course.titleTh)
                  : pick(lang, ACTIVITY_LABEL[g.activity].en, ACTIVITY_LABEL[g.activity].th)}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {course
                  ? `${course.chapterCount} ${tt("lessons", "บทเรียน")} · ${course.hours}${tt("h", " ชม.")}`
                  : tt("No course attached", "ไม่มีหลักสูตรที่ผูกไว้")}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px] font-light text-muted">
                <span>{t("label.progress")}</span>
                <span className="tabular-nums">{g.progress}%</span>
              </div>
              <Progress className="mt-1" tone={g.progress >= 100 ? "success" : "amber"} value={g.progress} />
            </div>
          </div>
          <div className="flex gap-2 lg:w-60">
            <Button className="min-h-12 min-w-0 flex-1 font-bold" onClick={action.go}>
              {course ? <Play size={14} /> : <Paperclip size={14} />}
              <span className="truncate">{action.label}</span>
            </Button>
            <Button
              variant="outline"
              className="min-h-12"
              onClick={() => setDetailsId(g.id)}
              aria-label={tt("Details", "รายละเอียด")}
            >
              {tt("Details", "รายละเอียด")}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  /** What a competency without a goal says instead: its standing, in words. */
  const statusText = (c: RowCompetency) => {
    if (c.expected === null) {
      return { tone: "text-muted", text: tt("Not assessed for your role", "ไม่ได้ประเมินในบทบาทของคุณ") };
    }
    if (c.manager === null) {
      return {
        tone: "text-muted",
        text: tt(
          "Not reviewed yet — waiting for your supervisor",
          "ยังไม่ได้รับการประเมิน — รอหัวหน้าประเมิน",
        ),
      };
    }
    const score = `(${c.manager}/${c.expected})`;
    const verdict = verdictFor(c.manager - c.expected);
    if (verdict === "strength") {
      return { tone: "text-success", text: tt(`Above the standard ${score}`, `เกินมาตรฐาน ${score}`) };
    }
    if (verdict === "standard") {
      return { tone: "text-success", text: tt(`Meets the standard ${score}`, `ตรงตามมาตรฐาน ${score}`) };
    }
    return {
      tone: "text-amber",
      text: tt(
        `Gap ${c.manager} → ${c.expected} · no course yet`,
        `ช่องว่าง ${c.manager} → ${c.expected} · ยังไม่มีคอร์ส`,
      ),
    };
  };

  /** One row per competency in a group: its goals, or a status line. */
  const competencyRow = (c: RowCompetency) => {
    const name = pick(lang, c.nameEn, c.nameTh);
    const own = goalsOf(c.competencyId);
    const status = own.length ? null : statusText(c);
    return (
      <Card key={c.competencyId} className="overflow-hidden">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("size-3 shrink-0 rounded-full", own.length ? "bg-accent" : "bg-line-2")} />
            <h3 className="line-clamp-2 min-w-0 flex-1 text-lg font-bold text-ink lg:text-xl" title={name}>
              {name}
            </h3>
            {c.expected !== null ? (
              <span className="shrink-0 text-xs text-muted">
                {tt(`Expected level ${c.expected}`, `ระดับที่คาดหวัง ${c.expected}`)}
              </span>
            ) : null}
          </div>
          {status ? (
            <p className={cn("mt-2 pl-6 text-sm font-medium", status.tone)}>{status.text}</p>
          ) : (
            <div className="mt-4 space-y-4">{own.map(goalBlock)}</div>
          )}
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

      {/* --------------------------------------------- rows by group (tabs) */}
      <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-medium text-ink lg:text-[32px]">
          {tt("In progress", "กำลังดำเนินการ")}
        </p>
        {groups.length > 1 ? (
          <Tabs
            variant="dark"
            value={activeGroup}
            onChange={setGroup}
            options={groups.map((g) => ({ value: g, label: groupLabel(g) }))}
          />
        ) : null}
      </div>

      {groups.length ? (
        /* every group's rows share one grid cell and only the active one is
           visible, so the area is as tall as the tallest group and switching
           tabs never moves the rest of the page */
        <div className="grid grid-cols-1">
          {groups.map((gr) => {
            const list = rows.filter((r) => r.group === gr);
            const active = gr === activeGroup;
            return (
              <div
                key={gr}
                aria-hidden={!active}
                className={cn("space-y-4 [grid-area:1/1]", !active && "invisible pointer-events-none")}
              >
                {list.map(competencyRow)}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={tt("No development goals yet", "ยังไม่มีเป้าหมายการพัฒนา")}
            hint={tt(
              "Your goals are set for you. Courses are assigned from your assessment: where your supervisor's score is below the level your position and career role expect, the courses in between are added here. Your supervisor can also set goals.",
              "เป้าหมายถูกกำหนดให้คุณ คอร์สมอบหมายจากผลประเมิน: สมรรถนะที่หัวหน้าให้คะแนนต่ำกว่าระดับที่ตำแหน่งและสายงานของคุณคาดหวัง ระบบจะเพิ่มคอร์สที่ต้องเรียนไว้ที่นี่ หัวหน้าก็กำหนดเป้าหมายเพิ่มได้",
            )}
          />
        </Card>
      )}

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
