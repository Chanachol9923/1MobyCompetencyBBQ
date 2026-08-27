"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Play,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeading,
  Pill,
  Progress,
  Tabs,
} from "@/components/ui";
import { GoalEvidencePanel } from "./GoalEvidence";
import { GoalTimeline, StatusPill, useStatusLabel } from "./GoalTimeline";
import { daysLeft, goalStatus, parseDate } from "./status";
import { GROUP_ORDER, groupsFor } from "@/components/profile/gap";
import {
  COMPETENCIES,
  GROUP_LABEL,
  GROUP_LABEL_TH,
  type Group,
} from "@/data/competencies";
import { coursesForCompetency, findCourse } from "@/data/learning";
import { useT } from "@/lib/i18n";
import {
  goalIsComplete,
  goalProgress,
  useDemo,
  type IdpGoal,
} from "@/lib/store";

const ACTIVITY_TH: Record<IdpGoal["activity"], string> = {
  "Online Course": "เรียนออนไลน์",
  Coaching: "โค้ชชิ่ง",
  "On-the-job Training": "ฝึกจากงานจริง",
};

const groupOf = (competencyId: string): Group =>
  COMPETENCIES.find((c) => c.id === competencyId)?.group ?? "core";

export default function IdpPage() {
  const { state, person } = useDemo();
  const { t, tt, lang } = useT();
  const router = useRouter();
  /** which course of the competency each goal card is showing */
  const [shownCourse, setShownCourse] = useState<Record<string, string>>({});
  const statusLabel = useStatusLabel();

  const personId = state.personId;
  const goals = useMemo<IdpGoal[]>(
    () => (personId ? (state.idp[personId] ?? []) : []),
    [state.idp, personId],
  );

  const groupLabel = (g: Group) =>
    lang === "th" ? GROUP_LABEL_TH[g] : GROUP_LABEL[g];

  const activityLabel = (a: IdpGoal["activity"]) =>
    lang === "th" ? ACTIVITY_TH[a] : a;

  /** Tabs: the groups this person is assessed on, plus any group a goal lives in. */
  const options = useMemo<Group[]>(() => {
    const allowed = new Set<Group>(person ? groupsFor(person) : GROUP_ORDER);
    goals.forEach((g) => allowed.add(groupOf(g.competencyId)));
    return GROUP_ORDER.filter((g) => allowed.has(g));
  }, [person, goals]);

  const [group, setGroup] = useState<Group | null>(null);
  const firstWithGoals =
    options.find((g) => goals.some((x) => groupOf(x.competencyId) === g)) ??
    options[0] ??
    "core";
  const activeGroup = group && options.includes(group) ? group : firstWithGoals;

  const visible = goals.filter((g) => groupOf(g.competencyId) === activeGroup);

  /* ------------------------------------------------- overall plan stats
     Every number below reads through `goalProgress`, so a course finished in
     the LMS moves the plan summary without anyone writing the same percentage
     twice. */
  const stats = useMemo(() => {
    const now = Date.now();
    const acc = { complete: 0, onTrack: 0, atRisk: 0, overdue: 0 };
    goals.forEach((g) => (acc[goalStatus(g, goalProgress(state, g), now)] += 1));
    const avg = goals.length
      ? Math.round(
          goals.reduce((a, g) => a + goalProgress(state, g), 0) / goals.length,
        )
      : 0;
    return { ...acc, avg };
  }, [goals, state]);

  if (!person || !personId) return null;

  const scrollToGoal = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) setGroup(groupOf(goal.competencyId));
    window.requestAnimationFrame(() => {
      document
        .getElementById(`goal-${goalId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  /* --------------------------------------------------- resume latest class */
  const inProgress =
    goals
      .filter((g) => !goalIsComplete(state, g) && goalProgress(state, g) > 0)
      .sort((a, b) => goalProgress(state, b) - goalProgress(state, a))[0] ??
    goals.find((g) => !goalIsComplete(state, g)) ??
    goals[0];
  const resumeCourse = inProgress ? findCourse(inProgress.courseId) : undefined;

  const dateFmt = (iso: string) =>
    new Date(parseDate(iso)).toLocaleDateString(
      lang === "th" ? "th-TH" : "en-GB",
      { day: "2-digit", month: "short", year: "numeric" },
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
          subtitle={tt(
            "Each bar is a goal window; the fill is its progress",
            "แต่ละแท่งคือช่วงเวลาของเป้าหมาย ส่วนที่ทึบคือความคืบหน้า",
          )}
        />
        <div className="px-5 pb-5">
          <GoalTimeline goals={goals} onSelect={scrollToGoal} />
        </div>
      </Card>

      {/* ------------------------------------------------------- goal list */}
      <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-medium text-ink lg:text-[32px]">
          {tt("On Progress", "กำลังดำเนินการ")}
        </p>
        <Tabs
          variant="dark"
          value={activeGroup}
          onChange={setGroup}
          options={options.map((g) => ({ value: g, label: groupLabel(g) }))}
        />
      </div>

      <div className="space-y-6">
        {visible.map((g) => {
          const planProgress = goalProgress(state, g);
          // true when the number above came from the LMS rather than the goal
          const syncedWithCourse =
            typeof state.courseProgress[g.courseId] === "number";
          const status = goalStatus(g, planProgress);
          const left = daysLeft(g);
          // every course that builds this competency: the one in the plan
          // first, then the rest of the catalogue for the same competency
          const pool = coursesForCompetency(g.competencyId);
          const options = [
            ...pool.filter((c) => c.id === g.courseId),
            ...pool.filter((c) => c.id !== g.courseId),
          ];
          if (options.length === 0) {
            const fallback = findCourse(g.courseId);
            if (fallback) options.push(fallback);
          }
          const shownId = shownCourse[g.id] ?? options[0]?.id ?? g.courseId;
          const index = Math.max(
            0,
            options.findIndex((c) => c.id === shownId),
          );
          const course = options[index] ?? findCourse(g.courseId);
          const courseId = course?.id ?? g.courseId;
          const courseProgress =
            courseId === g.courseId
              ? planProgress
              : (state.courseProgress[courseId] ?? 0);
          const showingPlanCourse = courseId === g.courseId;
          const show = (i: number) => {
            const next = options[(i + options.length) % options.length];
            if (next) setShownCourse((m) => ({ ...m, [g.id]: next.id }));
          };
          return (
            <Card key={g.id} id={`goal-${g.id}`} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="size-4 shrink-0 rounded-full bg-accent" />
                  <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-ink lg:text-[32px]">
                    {g.competencyName}
                  </h2>
                  <StatusPill status={status} />
                </div>

                {/* raise X from level A to B */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-brand-tint px-3 py-1.5 font-medium text-brand">
                    <Target size={15} className="shrink-0" />
                    {tt(
                      `Raise ${g.competencyName} from level ${g.fromLevel} to ${g.toLevel}`,
                      `พัฒนา ${g.competencyName} จากระดับ ${g.fromLevel} เป็นระดับ ${g.toLevel}`,
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarDays size={15} className="shrink-0" />
                    {dateFmt(g.startDate)} → {dateFmt(g.dueDate)}
                  </span>
                  <Pill tone="neutral">
                    <BookOpen size={12} className="mr-1.5 shrink-0" />
                    {activityLabel(g.activity)}
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
                    {g.remark}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
                  <div className="flex flex-1 flex-col gap-3 rounded-lg bg-surface px-4 py-3 sm:flex-row sm:items-center">
                    <span className="w-full shrink-0 sm:w-44">
                      <span className="block text-sm font-bold text-ink">
                        {(lang === "th" && course?.titleTh) ||
                          course?.title ||
                          g.courseTitle}
                      </span>
                      {course ? (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {course.lessons} {tt("lessons", "บทเรียน")} ·{" "}
                          {course.hours}
                          {tt("h", " ชม.")}
                          {courseId === g.courseId
                            ? " · " + tt("in your plan", "อยู่ในแผนของคุณ")
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
                      router.push(course ? `/lms/${courseId}` : "/lms")
                    }
                  >
                    {t("action.continue")}
                  </Button>
                </div>

                {/* the plan number is the course number — say so quietly */}
                {showingPlanCourse && syncedWithCourse ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <RefreshCw size={12} className="shrink-0" />
                    {tt(
                      "Synced with the course — finishing it in the LMS completes this goal",
                      "ซิงก์กับหลักสูตร — เมื่อเรียนจบในระบบการเรียนรู้ เป้าหมายนี้จะเสร็จสิ้นอัตโนมัติ",
                    )}
                  </p>
                ) : null}

                <GoalEvidencePanel goal={g} personId={personId} />
              </div>

              {/* one segment per course that builds this competency */}
              {options.length > 1 ? (
                <div className="flex items-center gap-2 px-5 pb-4">
                  <button
                    type="button"
                    onClick={() => show(index - 1)}
                    aria-label={tt("Previous course", "คอร์สก่อนหน้า")}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="flex flex-1 gap-1.5">
                    {options.map((c, i) => {
                      const p =
                        c.id === g.courseId
                          ? planProgress
                          : (state.courseProgress[c.id] ?? 0);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => show(i)}
                          title={`${c.title} — ${p}%`}
                          aria-label={`${c.title} — ${p}%`}
                          aria-current={i === index}
                          className="group flex-1 py-2"
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
                    aria-label={tt("Next course", "คอร์สถัดไป")}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                  >
                    <ChevronRight size={15} />
                  </button>

                  <span className="shrink-0 text-[11px] tabular-nums text-muted">
                    {index + 1}/{options.length}
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
                      `No ${GROUP_LABEL[activeGroup]} goals yet`,
                      `ยังไม่มีเป้าหมายในกลุ่ม ${GROUP_LABEL_TH[activeGroup]}`,
                    )
              }
              hint={
                goals.length === 0
                  ? tt(
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
      </div>

      {/* ------------------------------------------------ resume latest class */}
      {resumeCourse ? (
        <section className="mt-6">
          <h2 className="mb-4 text-2xl font-medium text-ink lg:text-[32px]">
            {tt("Resume your latest class!", "เรียนต่อจากคลาสล่าสุด!")}
          </h2>
          <div className="grid gap-6 rounded-2xl bg-ink p-6 lg:grid-cols-[1fr_340px] lg:p-8">
            <div className="grid min-h-[220px] place-items-center">
              <button
                type="button"
                aria-label={tt(
                  `Play ${resumeCourse.title}`,
                  `เล่น ${resumeCourse.title}`,
                )}
                onClick={() => router.push(`/lms/${resumeCourse.id}`)}
                className="grid size-20 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105 active:scale-95"
              >
                <Play size={34} fill="currentColor" />
              </button>
            </div>
            <div className="rounded-xl bg-brand p-3">
              <p className="px-1 pb-2 text-xs font-bold text-white/80">
                {resumeCourse.title}
              </p>
              <ul className="space-y-2.5">
                {resumeCourse.chapters.map((ch, i) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/lms/${resumeCourse.id}?chapter=${ch.id}`)
                      }
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-white transition-colors ${
                        i === 0
                          ? "border-accent bg-brand-dark"
                          : "border-white/25 bg-brand-dark/60 hover:bg-brand-dark"
                      }`}
                    >
                      {tt("Chapter", "บทที่")}{" "}
                      {Number(ch.id.replace(/\D/g, "")) || i + 1} | {ch.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-muted">
        {tt("Statuses shown", "สถานะที่แสดง")}:{" "}
        {(["onTrack", "atRisk", "overdue", "complete"] as const)
          .map((s) => statusLabel(s))
          .join(" · ")}
      </p>
    </div>
  );
}
