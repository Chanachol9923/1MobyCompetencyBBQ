"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Check,
  ClipboardCheck,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  Modal,
  PageHeading,
  Pill,
  Progress,
  ResponsiveTable,
  Tabs,
  Textarea,
} from "@/components/ui";
import { Donut, DonutLegend, type DonutSlice } from "@/components/charts";
import {
  ACTIVITY_TH,
  GoalFormModal,
  type GoalDraft,
} from "@/components/profile/GoalFormModal";
import { HeatMapTable } from "@/components/profile/HeatMapTable";
import { RadarPanel } from "@/components/profile/RadarPanel";
import { SkillPointsList } from "@/components/profile/SkillPointsList";
import { VerdictPill } from "@/components/profile/VerdictPill";
import {
  GROUP_ORDER,
  gapRows,
  groupsFor,
  heatValue,
  overallFor,
  radarRowsFor,
} from "@/components/profile/gap";
import {
  GROUP_LABEL,
  GROUP_LABEL_TH,
  COMPETENCIES,
  assessedFor,
  expectedFor,
  type Group,
} from "@/data/competencies";
import { directReportsOf } from "@/data/people";
import { findCourse } from "@/data/learning";
import { idpProgress } from "@/lib/selectors";
import { useT } from "@/lib/i18n";
import { initials } from "@/lib/utils";
import { goalProgress, useDemo, type IdpGoal } from "@/lib/store";

/** Deterministic LMS activity per team member (mirrors the Figma table). */
const LEARNING_COURSES = [
  "advanced-aws",
  "design-system",
  "nodejs-expert",
  "advanced-aws",
  "network-security",
  "design-system",
  "nodejs-expert",
  "leadership-team-dynamics",
  "advanced-aws",
  "project-management-essentials",
  "how-to-be-funny",
  "design-system",
];
const LEARNING_PROGRESS = [100, 65, 80, 10, 90, 100, 50, 35, 100, 20, 75, 45];

type LearningFilter = "all" | "learning" | "completed";

export default function TeamProfilePage() {
  const { state, person, update, notify, logActivity, pushNotification } =
    useDemo();
  const { t, tt, lang } = useT();
  const router = useRouter();

  const team = useMemo(
    () => (person ? directReportsOf(person.id) : []),
    [person],
  );

  const [group, setGroup] = useState<Group>("core");
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<LearningFilter>("all");
  /** null = closed, { goal: null } = create, { goal } = edit that row */
  const [goalForm, setGoalForm] = useState<{ goal: IdpGoal | null } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<IdpGoal | null>(null);

  const groupLabel = (g: Group) =>
    lang === "th" ? GROUP_LABEL_TH[g] : GROUP_LABEL[g];

  const groupChoices = useMemo(() => {
    const set = new Set<Group>();
    team.forEach((m) => groupsFor(m).forEach((g) => set.add(g)));
    return GROUP_ORDER.filter((g) => set.has(g));
  }, [team]);

  const activeGroup = groupChoices.includes(group)
    ? group
    : (groupChoices[0] ?? "core");

  /** Competencies visible in the heat map for the chosen group — the union
   *  across the team, so a column exists as soon as one member is assessed. */
  const competencies = useMemo(() => {
    const ids = new Set<string>();
    team.forEach((m) =>
      assessedFor(m.jobRole, activeGroup).forEach((c) => ids.add(c.id)),
    );
    return COMPETENCIES.filter(
      (c) => c.group === activeGroup && ids.has(c.id),
    );
  }, [team, activeGroup]);

  const completed = team.filter((m) => m.phase >= 100).length;
  const avgScore = team.length
    ? (team.reduce((a, m) => a + overallFor(state, m), 0) / team.length).toFixed(
        2,
      )
    : "0.00";
  const avgIdp = team.length
    ? Math.round(
        team.reduce((a, m) => a + idpProgress(state, m.id), 0) / team.length,
      )
    : 0;

  /* -------------------------------------------------- performance breakdown */
  const distribution = useMemo<DonutSlice[]>(() => {
    const buckets = { excellent: 0, good: 0, average: 0, needs: 0 };
    team.forEach((m) => {
      const rows = gapRows(state, m, activeGroup);
      if (!rows.length) return;
      const avg = rows.reduce((a, r) => a + r.manager, 0) / rows.length;
      if (avg >= 3.5) buckets.excellent += 1;
      else if (avg >= 3) buckets.good += 1;
      else if (avg >= 2.5) buckets.average += 1;
      else buckets.needs += 1;
    });
    return [
      { name: tt("Excellent", "ดีเยี่ยม"), value: buckets.excellent, color: "#00b916" },
      { name: tt("Good", "ดี"), value: buckets.good, color: "#006bff" },
      { name: tt("Average", "ปานกลาง"), value: buckets.average, color: "#faa21b" },
      {
        name: tt("Needs Improvement", "ต้องปรับปรุง"),
        value: buckets.needs,
        color: "#f05123",
      },
    ];
  }, [team, activeGroup, state, tt]);

  const rated = distribution.reduce((a, d) => a + d.value, 0);

  const learningStages = useMemo<DonutSlice[]>(
    () => [
      { name: tt("Super Learner", "ผู้เรียนตัวยง"), value: 5, color: "#00b916" },
      { name: tt("Active", "เรียนสม่ำเสมอ"), value: 3, color: "#006bff" },
      { name: tt("Average", "ปานกลาง"), value: 2, color: "#faa21b" },
      { name: tt("Passive", "ไม่ค่อยเรียน"), value: 2, color: "#f05123" },
    ],
    [tt],
  );

  const learningRows = useMemo(
    () =>
      team.map((m, i) => ({
        member: m,
        course: findCourse(LEARNING_COURSES[i % LEARNING_COURSES.length]!),
        progress: LEARNING_PROGRESS[i % LEARNING_PROGRESS.length]!,
      })),
    [team],
  );

  const visibleLearning = learningRows.filter((r) =>
    filter === "all"
      ? true
      : filter === "completed"
        ? r.progress >= 100
        : r.progress < 100,
  );

  const teamLearningAvg = learningRows.length
    ? Math.round(
        learningRows.reduce((a, r) => a + r.progress, 0) / learningRows.length,
      )
    : 0;

  /* ------------------------------------------------------ selected employee */
  const selected = team.find((m) => m.id === selectedId) ?? team[0];

  /** Every assessed competency for that person, worst gap first. */
  const gapsForSelected = useMemo(
    () =>
      selected ? [...gapRows(state, selected)].sort((a, b) => a.gap - b.gap) : [],
    [state, selected],
  );

  /** That member's live development plan — the rows the manager can edit. */
  const memberGoals = selected ? (state.idp[selected.id] ?? []) : [];

  const reviewKey = `${state.personId}:${selected?.id ?? ""}`;
  const review = state.managerReview[reviewKey];

  /* ------------------------------------------------------------- guards */
  if (state.role !== "l2") {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.teamProfile")} />
        <Card className="max-w-md p-6">
          <h2 className="text-lg font-bold text-ink">
            {tt("Managers only", "สำหรับหัวหน้างานเท่านั้น")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {tt(
              "Team Profile is available to accounts that have direct reports.",
              "หน้าโปรไฟล์ทีมใช้ได้เฉพาะบัญชีที่มีผู้ใต้บังคับบัญชาโดยตรง",
            )}
          </p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            {tt("Back to Dashboard", "กลับสู่แดชบอร์ด")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!person || !selected) return null;

  const firstName = selected.nickname || selected.name.split(" ")[0];

  /* -------------------------------------------------------------- actions */

  /** The stamp the employee reads on their own plan. */
  const composeRemark = (note: string) =>
    note
      ? tt(
          `Assigned by ${person.name} — ${note}`,
          `มอบหมายโดย ${person.name} — ${note}`,
        )
      : tt(`Assigned by ${person.name}`, `มอบหมายโดย ${person.name}`);

  const activityLabel = (a: IdpGoal["activity"]) =>
    lang === "th" ? ACTIVITY_TH[a] : a;

  /** Create or update — the same form feeds both. */
  const saveGoal = (draft: GoalDraft) => {
    const editing = goalForm?.goal ?? null;
    const remark = composeRemark(draft.note);
    const fields = {
      competencyId: draft.competencyId,
      competencyName: draft.competencyName,
      courseId: draft.courseId,
      courseTitle: draft.courseTitle,
      startDate: draft.startDate,
      dueDate: draft.dueDate,
      fromLevel: draft.fromLevel,
      toLevel: draft.toLevel,
      activity: draft.activity,
      remark,
    };
    const detail = `${draft.fromLevel} → ${draft.toLevel} · ${draft.activity} · ${draft.startDate} → ${draft.dueDate}`;

    if (editing) {
      update((s) => ({
        ...s,
        idp: {
          ...s.idp,
          [selected.id]: (s.idp[selected.id] ?? []).map((g) =>
            g.id === editing.id ? { ...g, ...fields } : g,
          ),
        },
      }));
      logActivity(
        "Edited IDP goal",
        `${selected.name} · ${draft.competencyName}`,
        detail,
      );
      pushNotification({
        audience: selected.id,
        title: tt(
          "Your manager updated a development goal",
          "หัวหน้าปรับแก้เป้าหมายพัฒนาของคุณ",
        ),
        body: tt(
          `${draft.competencyName} now runs level ${draft.fromLevel} to ${draft.toLevel} by ${draft.dueDate} via ${draft.activity}.`,
          `${draft.competencyName} ปรับเป็นระดับ ${draft.fromLevel} ถึง ${draft.toLevel} ภายใน ${draft.dueDate} ด้วยวิธี ${ACTIVITY_TH[draft.activity]}`,
        ),
        kind: "idp",
        channel: "Both",
        href: "/idp",
      });
      notify(
        tt(
          `Goal updated for ${selected.name}`,
          `แก้ไขเป้าหมายของ ${selected.name} แล้ว`,
        ),
      );
      setGoalForm(null);
      return;
    }

    const goal: IdpGoal = {
      id: `g-${Date.now()}`,
      progress: 0,
      complete: false,
      ...fields,
    };
    update((s) => ({
      ...s,
      idp: { ...s.idp, [selected.id]: [...(s.idp[selected.id] ?? []), goal] },
      teamNotes: draft.note
        ? {
            ...s.teamNotes,
            [selected.id]: [s.teamNotes[selected.id], `• ${draft.note}`]
              .filter(Boolean)
              .join("\n"),
          }
        : s.teamNotes,
    }));
    logActivity(
      "Assigned IDP goal",
      `${selected.name} · ${draft.competencyName}`,
      detail,
    );
    pushNotification({
      audience: selected.id,
      title: tt(
        "Your manager added a development goal",
        "หัวหน้าเพิ่มเป้าหมายพัฒนาให้คุณ",
      ),
      body: tt(
        `Raise ${draft.competencyName} from level ${draft.fromLevel} to ${draft.toLevel} by ${draft.dueDate} via ${draft.activity}.`,
        `พัฒนา ${draft.competencyName} จากระดับ ${draft.fromLevel} เป็น ${draft.toLevel} ภายใน ${draft.dueDate} ด้วยวิธี ${ACTIVITY_TH[draft.activity]}`,
      ),
      kind: "idp",
      channel: "Both",
      href: "/idp",
    });
    notify(
      tt(`Goal added to ${selected.name}`, `เพิ่มเป้าหมายให้ ${selected.name} แล้ว`),
    );
    setGoalForm(null);
  };

  const removeGoal = (goal: IdpGoal) => {
    update((s) => ({
      ...s,
      idp: {
        ...s.idp,
        [selected.id]: (s.idp[selected.id] ?? []).filter(
          (g) => g.id !== goal.id,
        ),
      },
    }));
    logActivity(
      "Removed IDP goal",
      `${selected.name} · ${goal.competencyName}`,
      `${goal.activity} · ${goal.startDate} → ${goal.dueDate}`,
    );
    pushNotification({
      audience: selected.id,
      title: tt(
        "Your manager removed a development goal",
        "หัวหน้านำเป้าหมายพัฒนาออกจากแผนของคุณ",
      ),
      body: tt(
        `${goal.competencyName} (${goal.courseTitle}) is no longer part of your development plan.`,
        `${goal.competencyName} (${goal.courseTitle}) ไม่อยู่ในแผนพัฒนาของคุณแล้ว`,
      ),
      kind: "idp",
      channel: "Both",
      href: "/idp",
    });
    notify(
      tt(
        `Goal removed from ${selected.name}`,
        `ลบเป้าหมายของ ${selected.name} แล้ว`,
      ),
    );
    setPendingDelete(null);
  };

  /**
   * A manager review is a real assessment, not a checkbox - send the manager
   * into the supervisor wizard for this person rather than stamping a result.
   */
  const evaluateNow = () => {
    logActivity("Opened manager review", selected.name);
    router.push(`/assessment/supervisor/${selected.id}`);
  };


  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.teamProfile")}
        subtitle={tt(
          `${team.length} direct reports of ${person.name}`,
          `ผู้ใต้บังคับบัญชาโดยตรงของ ${person.name} จำนวน ${team.length} คน`,
        )}
        right={
          <Button variant="outline" onClick={() => router.push("/reports")}>
            <BarChart3 size={16} />
            {tt("View full report", "ดูรายงานฉบับเต็ม")}
          </Button>
        }
      />

      {/* ------------------------------------------------------- stat cards */}
      <div className="grid items-stretch gap-6 sm:grid-cols-3">
        <Card className="flex flex-col justify-between p-5">
          <p className="text-base font-bold text-ink">
            {tt("Assessment Completed", "ประเมินเสร็จแล้ว")}
          </p>
          <p className="mt-1 text-3xl font-bold text-brand">
            {completed}/{team.length}
          </p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="text-base font-bold text-ink">
            {tt("Team Avg Score", "คะแนนเฉลี่ยของทีม")}
          </p>
          <p className="mt-1 text-3xl font-bold text-success">{avgScore}</p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="text-base font-bold text-ink">
            {tt("IDP Progress", "ความคืบหน้าแผนพัฒนา")}
          </p>
          <p className="mt-1 text-3xl font-bold text-amber">{avgIdp}%</p>
        </Card>
      </div>

      {/* ------------------------------------ group selector + distribution */}
      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[240px_1fr]">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {groupChoices.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`min-h-[86px] flex-1 rounded-xl px-3 py-4 text-xl font-bold transition-colors ${
                activeGroup === g
                  ? "bg-ink text-white"
                  : "bg-surface text-muted hover:text-ink"
              }`}
            >
              {groupLabel(g)}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6 rounded-xl bg-[linear-gradient(100deg,#0b1b3f_0%,#00306e_35%,#006bff_100%)] p-6 sm:flex-row sm:justify-around">
          <Donut
            data={distribution}
            total={rated}
            totalLabel={tt("TOTAL", "ทั้งหมด")}
            size={175}
            dark
          />
          <div className="w-full max-w-[260px]">
            <p className="mb-3 text-base font-bold text-white">
              {tt("Performance Dist.", "การกระจายผลงาน")}
            </p>
            <DonutLegend data={distribution} dark />
            <p className="mt-3 text-[11px] text-white/70">
              {tt(
                `${rated} of ${team.length} assessed on ${groupLabel(activeGroup)}`,
                `${rated} จาก ${team.length} คน ถูกประเมินในกลุ่ม ${groupLabel(activeGroup)}`,
              )}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- heat map */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-ink lg:text-[32px]">
            {tt("Team Competency Heat map", "แผนภาพความร้อนสมรรถนะทีม")}
          </h2>
          <Pill tone="brand">{groupLabel(activeGroup)}</Pill>
        </div>
        <Card className="p-4">
          <HeatMapTable
            members={team}
            competencies={competencies}
            scoreOf={(pid, cid) => {
              const m = team.find((x) => x.id === pid);
              return m ? heatValue(state, m, cid) : null;
            }}
            expectedOf={(pid, cid) => {
              const m = team.find((x) => x.id === pid);
              return m ? expectedFor(m.jobRole, cid) : null;
            }}
            selectedId={selected.id}
            onSelect={setSelectedId}
          />
          <p className="mt-3 text-xs text-muted">
            {tt(
              "Select a row to load that member into the panel below. Cells marked N/A are competencies that role is not assessed on.",
              "เลือกแถวเพื่อโหลดสมาชิกคนนั้นในแผงด้านล่าง ช่องที่ระบุว่าไม่ประเมิน คือสมรรถนะที่ตำแหน่งนั้นไม่ถูกประเมิน",
            )}
          </p>
        </Card>
      </section>

      {/* ----------------------------------------------- selected employee */}
      <section className="mt-6">
        <h2 className="mb-4 text-2xl font-bold text-ink lg:text-[32px]">
          {tt("Selected Employee", "พนักงานที่เลือก")}
        </h2>

        <div className="rounded-2xl bg-brand p-4">
          {/* header */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-line-2/60 text-lg font-bold text-white">
              {initials(selected.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-medium text-ink lg:text-2xl">
                {selected.name}
              </p>
              <p className="truncate text-sm font-light text-muted">
                {selected.position} ({selected.level})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">
                {tt("Overall", "ภาพรวม")} {overallFor(state, selected).toFixed(2)}
              </Pill>
              {gapsForSelected[0] ? (
                <VerdictPill verdict={gapsForSelected[0].verdict} />
              ) : null}
            </div>
          </div>

          {/* radar + skills + note */}
          <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1fr_280px]">
            <div className="grid items-stretch gap-4 rounded-xl bg-white p-4 lg:grid-cols-2">
              <RadarPanel
                data={radarRowsFor(state, selected, activeGroup)}
                height={230}
                label={groupLabel(activeGroup)}
              />
              <SkillPointsList
                rows={gapRows(state, selected, activeGroup)}
                compact
                className="lg:pt-4"
              />
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="mb-2 text-base font-medium text-ink">
                {t("label.notes")}:
              </p>
              <Textarea
                className="min-h-[180px]"
                placeholder={tt(
                  `Coaching notes for ${firstName}…`,
                  `บันทึกการโค้ช ${firstName}…`,
                )}
                value={state.teamNotes[selected.id] ?? ""}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    teamNotes: { ...s.teamNotes, [selected.id]: e.target.value },
                  }))
                }
              />
            </div>
          </div>

          {/* development plan — add / edit / delete */}
          <div className="mt-4 rounded-xl bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-ink">
                  {tt(
                    `Development plan for ${firstName}`,
                    `แผนพัฒนาของ ${firstName}`,
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {tt(
                    `${memberGoals.length} activities — add, edit or remove any of them.`,
                    `${memberGoals.length} กิจกรรม — เพิ่ม แก้ไข หรือลบได้`,
                  )}
                </p>
              </div>
              <Button onClick={() => setGoalForm({ goal: null })}>
                <Plus size={16} />
                {tt("Add goal", "เพิ่มเป้าหมาย")}
              </Button>
            </div>

            <ResponsiveTable className="mt-3" cardClassName="border-line">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-normal text-muted">
                    <th className="px-3 py-3 font-normal">
                      {t("label.competency")}
                    </th>
                    <th className="px-3 py-3 font-normal">
                      {t("label.course")}
                    </th>
                    <th className="px-3 py-3 font-normal">
                      {tt("Activity", "วิธีการพัฒนา")}
                    </th>
                    <th className="px-3 py-3 font-normal">
                      {tt("Timeline", "กรอบเวลา")}
                    </th>
                    <th className="w-[180px] px-3 py-3 font-normal">
                      {t("label.progress")}
                    </th>
                    <th className="px-3 py-3 text-right font-normal">
                      {t("label.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memberGoals.map((g) => (
                    <tr key={g.id} className="border-b border-line/60">
                      <td className="px-3 py-3">
                        <span className="block text-[13px] font-bold text-ink">
                          {g.competencyName}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {tt(
                            `Level ${g.fromLevel} → ${g.toLevel}`,
                            `ระดับ ${g.fromLevel} → ${g.toLevel}`,
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-light text-ink">
                        {g.courseTitle}
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone="brand">{activityLabel(g.activity)}</Pill>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-light text-ink">
                        {g.startDate} → {g.dueDate}
                      </td>
                      <td className="px-3 py-3">
                        <Progress
                          value={goalProgress(state, g)}
                          tone="amber"
                          showLabel
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGoalForm({ goal: g })}
                          >
                            <Pencil size={13} />
                            {t("action.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-accent hover:text-accent"
                            onClick={() => setPendingDelete(g)}
                          >
                            <Trash2 size={13} />
                            {t("action.delete")}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {memberGoals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted"
                      >
                        {tt(
                          `${firstName} has no development activities yet — add the first one.`,
                          `${firstName} ยังไม่มีกิจกรรมพัฒนา — เพิ่มรายการแรกได้เลย`,
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>

          {/* evaluated */}
          {review?.submittedAt ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white px-4 py-4 text-center">
              <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success">
                <Check size={18} />
              </span>
              <p className="text-lg font-bold text-success">
                {tt("Evaluated", "ประเมินแล้ว")} ·{" "}
                {new Date(review.submittedAt).toLocaleDateString(
                  lang === "th" ? "th-TH" : "en-GB",
                  { day: "2-digit", month: "short", year: "numeric" },
                )}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={evaluateNow}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-brand-dark px-4 py-3 text-xl font-bold text-white transition-colors hover:brightness-110"
            >
              <ClipboardCheck size={22} />
              {tt(
                `Evaluate ${selected.nickname || selected.name} Now`,
                `ประเมิน ${selected.nickname || selected.name} ตอนนี้`,
              )}
            </button>
          )}
        </div>
      </section>

      {/* ------------------------------------------- team learning progress */}
      <section className="mt-6">
        <Card className="grid gap-6 bg-brand-tint p-6 lg:grid-cols-[1fr_auto_260px] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold text-ink lg:text-[32px]">
              {tt("TEAM LEARNING PROGRESS", "ความคืบหน้าการเรียนรู้ของทีม")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {tt(
                `LMS activities summary (${team.length} members)`,
                `สรุปกิจกรรมการเรียนรู้ (${team.length} คน)`,
              )}
            </p>
            <p className="mt-6 text-right text-2xl font-bold text-brand lg:text-[32px]">
              {teamLearningAvg}%
            </p>
            <Progress className="mt-2" value={teamLearningAvg} />
          </div>
          <div className="justify-self-center">
            <Donut
              data={learningStages}
              total={learningStages.reduce((a, d) => a + d.value, 0)}
              size={170}
              totalLabel={tt("TOTAL", "ทั้งหมด")}
            />
          </div>
          <div>
            <p className="mb-3 text-base font-bold text-ink">
              {tt("Learning Stages", "ระดับการเรียนรู้")}
            </p>
            <DonutLegend data={learningStages} />
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------- learning members */}
      <section className="mt-6">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: tt("All", "ทั้งหมด") },
            { value: "learning", label: tt("Learning", "กำลังเรียน") },
            { value: "completed", label: tt("Completed", "เรียนจบ") },
          ]}
        />
        <Card className="mt-4 p-4">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-normal text-muted">
                  <th className="px-3 py-3 font-normal">{t("label.member")}</th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Current Course", "หลักสูตรปัจจุบัน")}
                  </th>
                  <th className="w-[200px] px-3 py-3 font-normal">
                    {t("label.progress")}
                  </th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Class Hours", "ชั่วโมงเรียน")}
                  </th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Latest Activity", "กิจกรรมล่าสุด")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLearning.map((r) => (
                  <tr key={r.member.id} className="border-b border-line/60">
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/60 text-[11px] font-bold text-white">
                          {initials(r.member.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold text-ink">
                            {r.member.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {r.member.position}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {r.course?.title ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Progress value={r.progress} showLabel />
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {r.course?.hours ?? 0} h
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {r.member.activity}
                    </td>
                  </tr>
                ))}
                {visibleLearning.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-muted">
                      {tt("No members in this state.", "ไม่มีสมาชิกในสถานะนี้")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------- add / edit a goal */}
      {goalForm ? (
        <GoalFormModal
          key={`${selected.id}:${goalForm.goal?.id ?? "new"}`}
          member={selected}
          goal={goalForm.goal}
          onClose={() => setGoalForm(null)}
          onSubmit={saveGoal}
        />
      ) : null}

      {/* ------------------------------------------------ delete a goal */}
      <Modal
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        width="max-w-md"
        title={tt("Remove this goal?", "ลบเป้าหมายนี้หรือไม่?")}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => pendingDelete && removeGoal(pendingDelete)}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <div className="text-sm text-muted">
            <p>
              {tt(
                `${pendingDelete.competencyName} (level ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) via ${activityLabel(pendingDelete.activity)} will be taken off ${selected.name}'s development plan.`,
                `${pendingDelete.competencyName} (ระดับ ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) ด้วยวิธี ${activityLabel(pendingDelete.activity)} จะถูกนำออกจากแผนพัฒนาของ ${selected.name}`,
              )}
            </p>
            <p className="mt-2">
              {tt(
                `Progress recorded against ${pendingDelete.courseTitle} stays in the LMS, and ${firstName} is notified.`,
                `ความคืบหน้าของหลักสูตร ${pendingDelete.courseTitle} ยังคงอยู่ในระบบการเรียนรู้ และ ${firstName} จะได้รับการแจ้งเตือน`,
              )}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
