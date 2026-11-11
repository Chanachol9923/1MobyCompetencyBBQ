"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Target,
  Trash2,
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
  GoalFormModal,
  type CourseChoice,
  type GoalDraft,
} from "@/components/profile/GoalFormModal";
import type { GapRow } from "@/components/profile/gap";
import { useUi } from "@/lib/ui-state";
import {
  deleteOwnGoalAction,
  saveOwnGoalAction,
  type OwnGoalError,
} from "./actions";
import {
  categoryDictKey,
  pick,
  type CourseCategory,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import type { CertificateOption, IdpGoalView } from "@/server/learning";
import { GoalEvidencePanel } from "./GoalEvidence";
import { GoalTimeline, StatusPill, useStatusLabel } from "./GoalTimeline";
import { daysLeft, goalStatus, parseDate } from "./status";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { SmoothPanel } from "@/components/ui/SmoothPanel";

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
 * Every percentage on the screen — the summary, the timeline, each card, each
 * segment of the course pager — is the number the server derived from this
 * person's chapter completions. Nothing is recomputed here and nothing is
 * stored: finishing a course in the LMS on a phone moves this screen on a
 * laptop, because both are reading the same `ChapterProgress` rows.
 *
 * Most goals are assigned by the manager in Team Profile. With `canEdit` the
 * owner may add activities of their own and edit or delete only those — the
 * server enforces the same rule; the buttons merely follow it. The learning
 * evidence panel is the other write this screen makes.
 */
export function IdpView({
  goals,
  certificates,
  assessedGroups,
  canEdit = false,
  rows = [],
  courses: courseChoices = [],
}: {
  goals: IdpGoalView[];
  certificates: CertificateOption[];
  assessedGroups: CourseCategory[];
  /** the viewer may add activities to their own plan */
  canEdit?: boolean;
  /** the viewer's own gap rows: the competencies an activity may target */
  rows?: GapRow[];
  courses?: CourseChoice[];
}) {
  const { t, tt, lang } = useT();
  // the stored stamp is "Assigned by NAME — note" (manager) or "Added by NAME
  // — note" (the owner); show the stamp in the reader's language and the
  // author's own words as written
  const remarkText = (remark: string) => {
    const m = /^(Assigned|Added) by (.+?)(?: — ([\s\S]*))?$/.exec(remark);
    if (!m) return remark;
    const stamp =
      m[1] === "Added"
        ? tt(`Added by ${m[2]}`, `เพิ่มโดย ${m[2]}`)
        : tt(`Assigned by ${m[2]}`, `มอบหมายโดย ${m[2]}`);
    return m[3] ? `${stamp} — ${m[3]}` : stamp;
  };
  const router = useRouter();

  /* ------------------------------------------------ the owner's own goals */
  const { notify } = useUi();
  const [form, setForm] = useState<{ goal: IdpGoalView | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IdpGoalView | null>(null);
  const [formError, setFormError] = useState<OwnGoalError | null>(null);
  const [saving, startSaving] = useTransition();

  const errorText = (code: OwnGoalError) =>
    ({
      not_authorised: tt("You cannot change this plan.", "คุณไม่มีสิทธิ์แก้ไขแผนนี้"),
      invalid: tt("Check the form and try again.", "ตรวจสอบข้อมูลแล้วลองใหม่"),
      unknown_competency: tt(
        "Your role is not assessed on that competency.",
        "บทบาทของคุณไม่ได้ประเมินสมรรถนะดังกล่าว",
      ),
      unknown_course: tt("That course is not available.", "หลักสูตรนี้ไม่เปิดให้เรียนแล้ว"),
      course_in_plan: tt(
        "That course is already in another goal of your plan.",
        "หลักสูตรนี้อยู่ในเป้าหมายอื่นของแผนคุณแล้ว",
      ),
      bad_dates: tt(
        "Due date must be after the start date.",
        "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
      ),
      bad_levels: tt(
        "The target level must be above the current level.",
        "ระดับเป้าหมายต้องสูงกว่าระดับปัจจุบัน",
      ),
      not_found: tt("That goal no longer exists.", "ไม่พบเป้าหมายนี้แล้ว"),
      not_yours: tt(
        "Only your manager can change a goal they set.",
        "เป้าหมายที่หัวหน้ากำหนด แก้ไขได้เฉพาะหัวหน้าเท่านั้น",
      ),
    })[code];

  const runOwn = (
    fn: () => Promise<{ ok: true } | { ok: false; error: OwnGoalError }>,
    done: () => void,
    success: string,
  ) => {
    setFormError(null);
    startSaving(async () => {
      const result = await fn();
      if (result.ok) {
        done();
        notify(success);
        router.refresh();
      } else if (form) {
        setFormError(result.error);
      } else {
        notify(errorText(result.error), "error");
      }
    });
  };

  const saveOwn = (draft: GoalDraft) =>
    runOwn(
      () => saveOwnGoalAction({ goalId: form?.goal?.id ?? null, ...draft }),
      () => setForm(null),
      form?.goal
        ? tt("Activity updated.", "อัปเดตกิจกรรมแล้ว")
        : tt("Activity added to your plan.", "เพิ่มกิจกรรมในแผนของคุณแล้ว"),
    );

  const removeOwn = (goal: IdpGoalView) =>
    runOwn(
      () => deleteOwnGoalAction({ goalId: goal.id }),
      () => setPendingDelete(null),
      tt("Activity removed.", "ลบกิจกรรมแล้ว"),
    );
  /** which course of the competency each goal card is showing */
  const [shownCourse, setShownCourse] = useState<Record<string, string>>({});
  const statusLabel = useStatusLabel();

  const goalName = (g: IdpGoalView) =>
    pick(lang, g.competencyNameEn, g.competencyNameTh);

  const groupLabel = (g: CourseCategory) => t(categoryDictKey(g));

  /** Tabs: the groups this person is assessed on, plus any group a goal is in. */
  const options = assessedGroups;

  const [group, setGroup] = useState<CourseCategory | null>(null);
  const firstWithGoals =
    options.find((g) => goals.some((x) => x.group === g)) ??
    options[0] ??
    "CORE";
  const activeGroup = group && options.includes(group) ? group : firstWithGoals;

  const visible = goals.filter((g) => g.group === activeGroup);

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

  const scrollToGoal = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) setGroup(goal.group);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`goal-${goalId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  /* --------------------------------------------------- resume latest class */
  const inProgress =
    goals
      .filter((g) => !g.complete && g.progress > 0)
      .sort((a, b) => b.progress - a.progress)[0] ??
    goals.find((g) => !g.complete) ??
    goals[0];
  const resumeCourse = inProgress?.courses.find((c) => c.inPlan);

  const dateFmt = (iso: string) =>
    new Date(parseDate(iso)).toLocaleDateString(
      lang === "th" ? "th-TH" : "en-GB",
      { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" },
    );

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

      {/* --------------------------------------------------- plan summary */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col justify-between p-4">
          <p className="text-xs text-muted">{t("label.progress")}</p>
          <p className="mt-0.5 text-2xl font-bold text-brand">{stats.avg}%</p>
          <Progress className="mt-2" tone="brand" value={stats.avg} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("status.onTrack")}</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">{stats.onTrack}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{tt("At risk", "เสี่ยงล่าช้า")}</p>
          <p className="mt-0.5 text-2xl font-bold text-amber">{stats.atRisk}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("status.overdue")}</p>
          <p className="mt-0.5 text-2xl font-bold text-accent">
            {stats.overdue}
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------------- timeline */}
      <Card className="mt-6">
        <CardHeader
          title={tt("Development timeline", "ไทม์ไลน์การพัฒนา")}
          subtitle={tt("Each bar is a goal's time frame; the filled part is its progress",
            "แต่ละแท่งคือช่วงเวลาของเป้าหมาย ส่วนที่ทึบคือความคืบหน้า",
          )}
        />
        <div className="px-5 pb-5">
          <GoalTimeline goals={timelineGoals} onSelect={scrollToGoal} />
        </div>
      </Card>

      {/* ------------------------------------------------------- goal list */}
      <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-medium text-ink lg:text-[32px]">
          {tt("In progress", "กำลังดำเนินการ")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {options.length ? (
            <Tabs
              variant="dark"
              value={activeGroup}
              onChange={setGroup}
              options={options.map((g) => ({ value: g, label: groupLabel(g) }))}
            />
          ) : null}
          {canEdit ? (
            <Button onClick={() => setForm({ goal: null })} disabled={saving}>
              <Plus size={15} />
              {tt("Add activity", "เพิ่มกิจกรรม")}
            </Button>
          ) : null}
        </div>
      </div>

      <SmoothPanel swapKey={activeGroup ?? ""} className="space-y-6">
        {visible.map((g) => {
          const status = goalStatus(g);
          const left = daysLeft(g);
          const name = goalName(g);
          // every course that builds this competency: the one in the plan
          // first, then the rest of the catalogue for the same competency
          const courses = g.courses;
          const shownId = shownCourse[g.id] ?? courses[0]?.id ?? "";
          const index = Math.max(
            0,
            courses.findIndex((c) => c.id === shownId),
          );
          const course = courses[index];
          const showingPlanCourse = course?.inPlan ?? false;
          // the card shows the goal's own number for the plan course, and the
          // course's own number for anything else in the pager
          const courseProgress = course
            ? course.inPlan
              ? g.progress
              : course.progress
            : g.progress;
          const show = (i: number) => {
            const next = courses[(i + courses.length) % courses.length];
            if (next) setShownCourse((m) => ({ ...m, [g.id]: next.id }));
          };
          return (
            <Card key={g.id} id={`goal-${g.id}`} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="size-4 shrink-0 rounded-full bg-accent" />
                  <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-ink lg:text-[32px]">
                    {name}
                  </h2>
                  <StatusPill status={status} />
                </div>

                {/* raise X from level A to B */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-brand-tint px-3 py-1.5 font-medium text-brand">
                    <Target size={15} className="shrink-0" />
                    {tt(
                      `Raise ${name} from level ${g.fromLevel} to ${g.toLevel}`,
                      `พัฒนา ${name} จากระดับ ${g.fromLevel} เป็นระดับ ${g.toLevel}`,
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarDays size={15} className="shrink-0" />
                    {dateFmt(g.startDate)} → {dateFmt(g.dueDate)}
                  </span>
                  <Pill tone="neutral">
                    <BookOpen size={12} className="mr-1.5 shrink-0" />
                    {pick(
                      lang,
                      ACTIVITY_LABEL[g.activity].en,
                      ACTIVITY_LABEL[g.activity].th,
                    )}
                  </Pill>
                  {status !== "complete" ? (
                    <span
                      className={`text-xs ${left < 0 ? "text-accent" : "text-muted"}`}
                    >
                      {left < 0
                        ? tt(`${-left} days overdue`, `เลยกำหนด ${-left} วัน`)
                        : tt(`${left} days left`, `เหลืออีก ${left} วัน`)}
                    </span>
                  ) : null}
                </div>

                {g.remark ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
                    <MessageSquare size={13} className="mt-0.5 shrink-0" />
                    <span>{remarkText(g.remark)}</span>
                  </p>
                ) : null}

                {/* only an activity the owner added is theirs to change */}
                {canEdit && g.selfAdded ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => setForm({ goal: g })}
                    >
                      <Pencil size={13} />
                      {t("action.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-accent hover:text-accent"
                      disabled={saving}
                      onClick={() => setPendingDelete(g)}
                    >
                      <Trash2 size={13} />
                      {t("action.delete")}
                    </Button>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
                  <div className="flex flex-1 flex-col gap-3 rounded-lg bg-surface px-4 py-3 sm:flex-row sm:items-center">
                    <span className="w-full shrink-0 sm:w-44">
                      <span className="block text-sm font-bold text-ink">
                        {course
                          ? pick(lang, course.titleEn, course.titleTh)
                          : tt("No course attached", "ไม่มีหลักสูตรที่ผูกไว้")}
                      </span>
                      {course ? (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {course.chapterCount} {tt("lessons", "บทเรียน")} ·{" "}
                          {course.hours}
                          {tt("h", " ชม.")}
                          {course.inPlan
                            ? " · " + tt("in your plan", "อยู่ในแผนของคุณ")
                            : ""}
                          {course.assigned
                            ? " · " + tt("assigned from your assessment", "มอบหมายจากผลประเมิน")
                            : ""}
                        </span>
                      ) : null}
                    </span>
                    {courseProgress >= 100 ? (
                      <span className="flex-1 text-center text-xl font-bold text-brand lg:text-2xl">
                        {t("label.complete")}
                      </span>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[11px] font-light text-muted">
                          <span>{t("label.progress")}</span>
                          <span>{courseProgress}%</span>
                        </div>
                        <Progress
                          className="mt-1"
                          tone="amber"
                          value={courseProgress}
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    className="min-h-12 font-bold lg:w-36"
                    onClick={() =>
                      router.push(course ? `/lms/${course.slug}` : "/lms")
                    }
                  >
                    {t("action.continue")}
                  </Button>
                </div>

                {/* the plan number is the course number — say so quietly */}
                {showingPlanCourse ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <RefreshCw size={12} className="shrink-0" />
                    {tt("Linked to the course — finishing it completes this goal",
                      "ผูกกับหลักสูตร — เรียนจบแล้วเป้าหมายนี้จะเสร็จเอง",
                    )}
                  </p>
                ) : null}

                <GoalEvidencePanel
                  goalId={g.id}
                  goalName={name}
                  planCourseId={g.courseId}
                  items={g.evidence}
                  certificates={certificates}
                />
              </div>

              {/* one segment per course that builds this competency */}
              {courses.length > 1 ? (
                <div className="flex items-center gap-2 px-5 pb-4">
                  <button
                    type="button"
                    onClick={() => show(index - 1)}
                    aria-label={tt("Previous course", "หลักสูตรก่อนหน้า")}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink max-lg:size-11"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="flex flex-1 gap-1.5">
                    {courses.map((c, i) => {
                      const p = c.inPlan ? g.progress : c.progress;
                      const title = pick(lang, c.titleEn, c.titleTh);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => show(i)}
                          title={`${title} — ${p}%`}
                          aria-label={`${title} — ${p}%`}
                          aria-current={i === index}
                          className="group flex-1 py-2 max-lg:py-4"
                        >
                          <span
                            className={`block h-1.5 overflow-hidden rounded-full transition-colors ${
                              i === index
                                ? "bg-line-2"
                                : "bg-line group-hover:bg-line-2"
                            }`}
                          >
                            <span
                              className={`block h-full rounded-full ${
                                i === index ? "bg-brand" : "bg-line-2"
                              }`}
                              style={{ width: `${Math.max(p, 4)}%` }}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => show(index + 1)}
                    aria-label={tt("Next course", "หลักสูตรถัดไป")}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink max-lg:size-11"
                  >
                    <ChevronRight size={15} />
                  </button>

                  <span className="shrink-0 text-[11px] tabular-nums text-muted">
                    {index + 1}/{courses.length}
                  </span>
                </div>
              ) : null}
            </Card>
          );
        })}

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              title={
                goals.length === 0
                  ? tt(
                      "Your manager has not set a development plan yet",
                      "หัวหน้ายังไม่ได้กำหนดแผนพัฒนาให้คุณ",
                    )
                  : tt(
                      `No ${groupLabel(activeGroup)} goals yet`,
                      `ยังไม่มีเป้าหมายในกลุ่ม ${groupLabel(activeGroup)}`,
                    )
              }
              hint={
                goals.length === 0
                  ? canEdit
                    ? tt(
                        "Your manager assigns goals from your competency gaps, and you can add your own with Add activity.",
                        "หัวหน้าจะกำหนดเป้าหมายจากช่องว่างสมรรถนะ และคุณเพิ่มกิจกรรมของตนเองได้ด้วยปุ่มเพิ่มกิจกรรม",
                      )
                    : tt(
                        "Development goals are assigned by your manager from your competency gaps.",
                        "เป้าหมายการพัฒนาจะถูกกำหนดโดยหัวหน้าของคุณจากช่องว่างสมรรถนะ",
                      )
                  : tt(
                      "Switch tabs to see goals in another competency group.",
                      "สลับแท็บเพื่อดูเป้าหมายในกลุ่มสมรรถนะอื่น",
                    )
              }
            />
          </Card>
        ) : null}
      </SmoothPanel>

      {/* ------------------------------------------------ resume latest class */}
      {resumeCourse ? (
        <section className="mt-6">
          <h2 className="mb-4 text-2xl font-medium text-ink lg:text-[32px]">
            {tt("Pick up where you left off", "เรียนต่อจากที่ค้างไว้")}
          </h2>
          <div className="grid gap-6 rounded-2xl bg-ink p-6 lg:grid-cols-[1fr_340px] lg:p-8">
            <div className="grid min-h-[220px] place-items-center">
              <button
                type="button"
                aria-label={tt(`Open ${pick(lang, resumeCourse.titleEn, resumeCourse.titleTh)}`,
                  `เปิด ${pick(lang, resumeCourse.titleEn, resumeCourse.titleTh)}`,
                )}
                onClick={() => router.push(`/lms/${resumeCourse.slug}`)}
                className="grid size-20 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105 active:scale-95"
              >
                <Play size={34} fill="currentColor" />
              </button>
            </div>
            <div className="rounded-xl bg-brand p-3">
              <p className="px-1 pb-2 text-xs font-bold text-white/80">
                {pick(lang, resumeCourse.titleEn, resumeCourse.titleTh)}
              </p>
              <div className="rounded-lg border border-accent bg-brand-dark px-3 py-2.5">
                <p className="text-sm font-medium text-white">
                  {resumeCourse.chapterCount} {tt("chapters", "บทเรียน")} ·{" "}
                  {resumeCourse.hours}
                  {tt("h", " ชม.")}
                </p>
                <p className="mt-1 text-[11px] text-white/70">
                  {tt(
                    `${resumeCourse.progress}% complete — pick up where you left off`,
                    `เรียนไปแล้ว ${resumeCourse.progress}% เรียนต่อจากจุดเดิมได้เลย`,
                  )}
                </p>
              </div>
              <Button
                className="mt-3 w-full"
                variant="amber"
                onClick={() => router.push(`/lms/${resumeCourse.slug}`)}
              >
                {t("action.continue")}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------ add / edit own activity */}
      {form ? (
        <GoalFormModal
          key={form.goal?.id ?? "new"}
          memberName=""
          self
          rows={rows}
          courses={courseChoices}
          goal={
            form.goal
              ? {
                  competencyId: form.goal.competencyId,
                  courseId: form.goal.courseId,
                  fromLevel: form.goal.fromLevel,
                  toLevel: form.goal.toLevel,
                  activity: form.goal.activity,
                  startDate: form.goal.startDate,
                  dueDate: form.goal.dueDate,
                  remark: form.goal.remark,
                }
              : null
          }
          pending={saving}
          error={formError ? errorText(formError) : null}
          onClose={() => {
            setForm(null);
            setFormError(null);
          }}
          onSubmit={saveOwn}
        />
      ) : null}

      <Modal
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        width="max-w-md"
        title={tt("Remove this activity?", "ลบกิจกรรมนี้หรือไม่?")}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => pendingDelete && removeOwn(pendingDelete)}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p className="text-sm text-muted">
            {tt(
              `${goalName(pendingDelete)} (level ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) will be taken off your development plan. Your manager is told.`,
              `${goalName(pendingDelete)} (ระดับ ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) จะถูกนำออกจากแผนพัฒนาของคุณ และหัวหน้าจะได้รับแจ้ง`,
            )}
          </p>
        ) : null}
      </Modal>

      <p className="mt-6 text-xs text-muted">
        {tt("Statuses shown", "สถานะที่แสดง")}:{" "}
        {(["onTrack", "atRisk", "overdue", "complete"] as const)
          .map((s) => statusLabel(s))
          .join(" · ")}
      </p>
    </div>
  );
}
