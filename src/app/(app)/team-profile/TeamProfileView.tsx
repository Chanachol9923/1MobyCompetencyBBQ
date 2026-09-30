"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Check,
  ClipboardCheck,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
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
  ACTIVITY_LABEL,
  GoalFormModal,
  type ActivityKey,
  type CourseChoice,
  type GoalDraft,
} from "@/components/profile/GoalFormModal";
import {
  HeatMapTable,
  type HeatCompetency,
} from "@/components/profile/HeatMapTable";
import { RadarPanel } from "@/components/profile/RadarPanel";
import { SkillPointsList } from "@/components/profile/SkillPointsList";
import { VerdictPill } from "@/components/profile/VerdictPill";
import {
  COMPETENCY_GROUPS,
  groupDictKey,
  pick,
  toRadarData,
  type CompetencyGroup,
  type GapRow,
} from "@/components/profile/gap";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui-state";
import { initials } from "@/lib/utils";
import {
  deleteGoalAction,
  saveCoachingNoteAction,
  saveGoalAction,
  type ActionError,
} from "./actions";

export type MemberCells = Record<
  string,
  {
    expected: number | null;
    self: number | null;
    manager: number | null;
    score: number | null;
  }
>;

export type TeamProfileMember = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
  jobRole: string;
  level: string;
  skillIndex: number;
  averageExpected: number;
  cycleProgress: number;
  /** ISO timestamp of this manager's submitted supervisor assessment */
  reviewedAt: string | null;
  note: string;
  cells: MemberCells;
  learning: {
    courseTitleEn: string | null;
    courseTitleTh: string | null;
    hours: number;
    progress: number;
    enrolledCount: number;
    completedCount: number;
    lastActivity: string | null;
  };
};

export type TeamGoal = {
  id: string;
  employeeId: string;
  competencyId: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  courseId: string | null;
  courseTitleEn: string | null;
  courseTitleTh: string | null;
  fromLevel: number;
  toLevel: number;
  activity: ActivityKey;
  startDate: string;
  dueDate: string;
  remark: string | null;
  progress: number;
  complete: boolean;
};

type LearningFilter = "all" | "learning" | "completed";

export function TeamProfileView({
  managerName,
  members,
  competencies,
  rowsByMember,
  goalsByMember,
  courses,
}: {
  managerName: string;
  members: TeamProfileMember[];
  competencies: (HeatCompetency & { group: CompetencyGroup })[];
  rowsByMember: Record<string, GapRow[]>;
  goalsByMember: Record<string, TeamGoal[]>;
  courses: CourseChoice[];
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();

  const [group, setGroup] = useState<CompetencyGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<LearningFilter>("all");
  /** null = closed, { goal: null } = create, { goal } = edit that row */
  const [goalForm, setGoalForm] = useState<{ goal: TeamGoal | null } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<TeamGoal | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (code: ActionError) =>
    ({
      not_authorised: tt(
        "Only this person's manager can do that.",
        "เฉพาะหัวหน้าโดยตรงของพนักงานคนนี้เท่านั้นที่ทำรายการนี้ได้",
      ),
      invalid: tt("Check the form and try again.", "ตรวจสอบข้อมูลแล้วลองใหม่"),
      unknown_competency: tt(
        "This role is not assessed on that competency.",
        "ตำแหน่งนี้ไม่ได้ถูกประเมินในสมรรถนะดังกล่าว",
      ),
      unknown_course: tt("That course no longer exists.", "ไม่พบหลักสูตรนี้แล้ว"),
      bad_dates: tt(
        "Due date must be after the start date.",
        "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
      ),
      bad_levels: tt(
        "The target level must be above the current level.",
        "ระดับเป้าหมายต้องสูงกว่าระดับปัจจุบัน",
      ),
      not_found: tt("That record no longer exists.", "ไม่พบรายการนี้แล้ว"),
    })[code];

  const groupLabel = (g: CompetencyGroup) => t(groupDictKey(g));

  const groupChoices = useMemo(
    () => COMPETENCY_GROUPS.filter((g) => competencies.some((c) => c.group === g)),
    [competencies],
  );
  const activeGroup =
    group && groupChoices.includes(group) ? group : groupChoices[0];

  const groupCompetencies = useMemo(
    () => competencies.filter((c) => c.group === activeGroup),
    [competencies, activeGroup],
  );

  const selected =
    members.find((m) => m.id === selectedId) ?? members[0] ?? null;

  /* --------------------------------------------------------- headline numbers */
  const reviewed = members.filter((m) => m.reviewedAt !== null).length;
  const scoredMembers = members.filter((m) => m.skillIndex > 0);
  const avgScore = scoredMembers.length
    ? (
        scoredMembers.reduce((a, m) => a + m.skillIndex, 0) /
        scoredMembers.length
      ).toFixed(2)
    : null;

  const allGoals = members.flatMap((m) => goalsByMember[m.id] ?? []);
  const avgIdp = allGoals.length
    ? Math.round(allGoals.reduce((a, g) => a + g.progress, 0) / allGoals.length)
    : null;

  /* -------------------------------------------------- performance breakdown */
  const distribution = useMemo<DonutSlice[]>(() => {
    const buckets = { excellent: 0, good: 0, average: 0, needs: 0 };
    members.forEach((m) => {
      const rows = (rowsByMember[m.id] ?? []).filter(
        (r) => r.group === activeGroup && r.score !== null,
      );
      if (!rows.length) return;
      const avg = rows.reduce((a, r) => a + (r.score ?? 0), 0) / rows.length;
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
        name: tt("Needs improvement", "ต้องปรับปรุง"),
        value: buckets.needs,
        color: "#f05123",
      },
    ];
  }, [members, rowsByMember, activeGroup, tt]);

  const rated = distribution.reduce((a, d) => a + d.value, 0);

  /* ------------------------------------------------------- learning roll-up */
  const learningStages = useMemo<DonutSlice[]>(() => {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    members.forEach((m) => {
      const l = m.learning;
      if (l.enrolledCount === 0) notStarted += 1;
      else if (l.completedCount === l.enrolledCount) completed += 1;
      else inProgress += 1;
    });
    return [
      { name: tt("Completed", "เรียนจบ"), value: completed, color: "#00b916" },
      { name: tt("In progress", "กำลังเรียน"), value: inProgress, color: "#006bff" },
      { name: tt("Not started", "ยังไม่เริ่ม"), value: notStarted, color: "#a2a9b0" },
    ];
  }, [members, tt]);

  const teamLearningAvg = members.length
    ? Math.round(
        members.reduce((a, m) => a + m.learning.progress, 0) / members.length,
      )
    : 0;

  const visibleLearning = members.filter((m) =>
    filter === "all"
      ? true
      : filter === "completed"
        ? m.learning.enrolledCount > 0 &&
          m.learning.completedCount === m.learning.enrolledCount
        : m.learning.enrolledCount > m.learning.completedCount,
  );

  /* ------------------------------------------------------ selected employee */
  const selectedRows = selected ? (rowsByMember[selected.id] ?? []) : [];
  const groupRows = selectedRows.filter((r) => r.group === activeGroup);
  const memberGoals = selected ? (goalsByMember[selected.id] ?? []) : [];
  const worstFirst = [...selectedRows]
    .filter((r) => r.score !== null)
    .sort((a, b) => a.gap - b.gap);

  const [note, setNote] = useState<string | null>(null);
  const noteValue = note ?? selected?.note ?? "";
  const noteDirty = selected != null && noteValue !== selected.note;

  /* -------------------------------------------------------------- actions */

  const { notify } = useUi();
  const run = (
    fn: () => Promise<{ ok: true } | { ok: false; error: ActionError }>,
    done: () => void,
    success: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        done();
        notify(success);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  // an error while no dialog is open goes to the app-wide toast
  useEffect(() => {
    if (!error || goalForm) return;
    notify(errorText(error), "error");
    setError(null);
    // errorText is recreated each render; the error value is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, goalForm]);

  const saveGoal = (draft: GoalDraft) => {
    if (!selected) return;
    run(
      () =>
        saveGoalAction({
          goalId: goalForm?.goal?.id ?? null,
          employeeId: selected.id,
          ...draft,
        }),
      () => setGoalForm(null),
      goalForm?.goal
        ? tt("Goal updated.", "อัปเดตเป้าหมายแล้ว")
        : tt(`Goal added to ${selected.name}'s plan.`, `เพิ่มเป้าหมายในแผนของ ${selected.name} แล้ว`),
    );
  };

  const removeGoal = (goal: TeamGoal) => {
    run(
      () => deleteGoalAction({ goalId: goal.id, employeeId: goal.employeeId }),
      () => setPendingDelete(null),
      tt("Goal removed.", "ลบเป้าหมายแล้ว"),
    );
  };

  const saveNote = () => {
    if (!selected) return;
    run(
      () =>
        saveCoachingNoteAction({ employeeId: selected.id, body: noteValue }),
      () => setNote(null),
      tt("Note saved.", "บันทึกโน้ตแล้ว"),
    );
  };

  const activityLabel = (a: ActivityKey) => ACTIVITY_LABEL[a][lang];

  /* --------------------------------------------------------------- empty */
  if (!selected || !activeGroup) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.teamProfile")} />
        <Card>
          <EmptyState
            title={tt("No direct reports", "ยังไม่มีผู้ใต้บังคับบัญชาโดยตรง")}
            hint={tt(
              "Team Profile follows the org chart. This account has nobody reporting to it yet.",
              "หน้าโปรไฟล์ทีมอ้างอิงตามผังองค์กร บัญชีนี้ยังไม่มีผู้ใต้บังคับบัญชาโดยตรง",
            )}
          />
        </Card>
      </div>
    );
  }

  const firstName = selected.nickname || selected.name.split(" ")[0] || selected.name;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.teamProfile")}
        subtitle={tt(
          `${members.length} direct reports of ${managerName}`,
          `ผู้ใต้บังคับบัญชาโดยตรงของ ${managerName} จำนวน ${members.length} คน`,
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
            {tt("Assessments completed", "ประเมินเสร็จแล้ว")}
          </p>
          <p className="mt-1 text-3xl font-bold text-brand">
            {reviewed}/{members.length}
          </p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="text-base font-bold text-ink">
            {tt("Team average score", "คะแนนเฉลี่ยของทีม")}
          </p>
          <p className="mt-1 text-3xl font-bold text-success">
            {avgScore ?? tt("No scores yet", "ยังไม่มีคะแนน")}
          </p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="text-base font-bold text-ink">
            {tt("IDP progress", "ความคืบหน้าแผนพัฒนา")}
          </p>
          <p className="mt-1 text-3xl font-bold text-amber">
            {avgIdp === null
              ? tt("No goals yet", "ยังไม่มีเป้าหมาย")
              : `${avgIdp}%`}
          </p>
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
            totalLabel={tt("Total", "ทั้งหมด")}
            size={175}
            dark
          />
          <div className="w-full max-w-[260px]">
            <p className="mb-3 text-base font-bold text-white">
              {tt("Performance distribution", "การกระจายผลงาน")}
            </p>
            <DonutLegend data={distribution} dark />
            <p className="mt-3 text-[11px] text-white/70">
              {tt(
                `${rated} of ${members.length} scored on ${groupLabel(activeGroup)}`,
                `${rated} จาก ${members.length} คน มีคะแนนในกลุ่ม ${groupLabel(activeGroup)}`,
              )}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- heat map */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-ink lg:text-[32px]">
            {tt("Team competency heat map", "ฮีตแมปสมรรถนะของทีม")}
          </h2>
          <Pill tone="brand">{groupLabel(activeGroup)}</Pill>
        </div>
        <Card className="p-4">
          <HeatMapTable
            members={members}
            competencies={groupCompetencies}
            scoreOf={(id, cid) =>
              members.find((m) => m.id === id)?.cells[cid]?.score ?? null
            }
            expectedOf={(id, cid) =>
              members.find((m) => m.id === id)?.cells[cid]?.expected ?? null
            }
            selectedId={selected.id}
            onSelect={(id) => {
              setSelectedId(id);
              setNote(null);
              setError(null);
            }}
          />
          <p className="mt-3 text-xs text-muted">
            {tt("Select someone to see their details below. N/A means their role is not assessed on that competency.",
              "เลือกสมาชิกเพื่อดูรายละเอียดด้านล่าง ช่อง “ไม่ประเมิน” หมายถึงตำแหน่งของคนนั้นไม่ได้ประเมินสมรรถนะนี้",
            )}
          </p>
        </Card>
      </section>

      {/* ----------------------------------------------- selected employee */}
      <section className="mt-6">
        <h2 className="mb-4 text-2xl font-bold text-ink lg:text-[32px]">
          {tt("Selected employee", "พนักงานที่เลือก")}
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
                {selected.position ?? selected.jobRole} ({selected.level})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">
                {tt("Overall", "ภาพรวม")} {selected.skillIndex.toFixed(2)}
              </Pill>
              {worstFirst[0] ? (
                <VerdictPill verdict={worstFirst[0].verdict} />
              ) : null}
            </div>
          </div>

          {/* radar + skills + note */}
          <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1fr_280px]">
            <div className="grid items-stretch gap-4 rounded-xl bg-white p-4 lg:grid-cols-2">
              <RadarPanel
                data={toRadarData(groupRows, lang)}
                height={230}
                label={groupLabel(activeGroup)}
              />
              <SkillPointsList rows={groupRows} compact className="lg:pt-4" />
            </div>
            <div className="flex flex-col rounded-xl bg-white p-4">
              <p className="mb-2 text-base font-medium text-ink">
                {t("label.notes")}:
              </p>
              <Textarea
                className="min-h-[180px] flex-1"
                placeholder={tt(
                  `Coaching notes for ${firstName}…`,
                  `บันทึกการโค้ช ${firstName}…`,
                )}
                value={noteValue}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {noteDirty
                    ? tt("Unsaved changes", "ยังไม่ได้บันทึก")
                    : tt("Saved", "บันทึกแล้ว")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveNote}
                  disabled={pending || !noteDirty}
                >
                  <Save size={13} />
                  {t("action.save")}
                </Button>
              </div>
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
              <Button
                onClick={() => setGoalForm({ goal: null })}
                disabled={pending || selectedRows.length === 0}
              >
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
                          {pick(lang, g.competencyNameEn, g.competencyNameTh)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {tt(
                            `Level ${g.fromLevel} → ${g.toLevel}`,
                            `ระดับ ${g.fromLevel} → ${g.toLevel}`,
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-light text-ink">
                        {g.courseTitleEn
                          ? pick(lang, g.courseTitleEn, g.courseTitleTh)
                          : tt("No course", "ไม่มีหลักสูตร")}
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone="brand">{activityLabel(g.activity)}</Pill>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-light text-ink">
                        {g.startDate} → {g.dueDate}
                      </td>
                      <td className="px-3 py-3">
                        <Progress value={g.progress} tone="amber" showLabel />
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => setGoalForm({ goal: g })}
                          >
                            <Pencil size={13} />
                            {t("action.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-accent hover:text-accent"
                            disabled={pending}
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
          {selected.reviewedAt ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white px-4 py-4 text-center">
              <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success">
                <Check size={18} />
              </span>
              <p className="text-lg font-bold text-success">
                {tt("Evaluated", "ประเมินแล้ว")} ·{" "}
                {new Date(selected.reviewedAt).toLocaleDateString(
                  lang === "th" ? "th-TH" : "en-GB",
                  { day: "2-digit", month: "short", year: "numeric" },
                )}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                router.push(`/assessment/supervisor/${selected.id}`)
              }
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-brand-dark px-4 py-3 text-xl font-bold text-white transition-colors hover:brightness-110"
            >
              <ClipboardCheck size={22} />
              {tt(`Review ${firstName} now`,
                `ประเมิน ${firstName} เลย`,
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
              {tt("Team learning progress", "ความคืบหน้าการเรียนรู้ของทีม")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {tt(
                `LMS activities summary (${members.length} members)`,
                `สรุปกิจกรรมการเรียนรู้ (${members.length} คน)`,
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
              total={members.length}
              size={170}
              totalLabel={tt("Total", "ทั้งหมด")}
            />
          </div>
          <div>
            <p className="mb-3 text-base font-bold text-ink">
              {tt("Learning stages", "สถานะการเรียน")}
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
          <ResponsiveTable cardClassName="border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-normal text-muted">
                  <th className="px-3 py-3 font-normal">{t("label.member")}</th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Current course", "หลักสูตรปัจจุบัน")}
                  </th>
                  <th className="w-[200px] px-3 py-3 font-normal">
                    {t("label.progress")}
                  </th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Class hours", "ชั่วโมงเรียน")}
                  </th>
                  <th className="px-3 py-3 font-normal">
                    {tt("Latest activity", "กิจกรรมล่าสุด")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLearning.map((m) => (
                  <tr key={m.id} className="border-b border-line/60">
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/60 text-[11px] font-bold text-white">
                          {initials(m.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold text-ink">
                            {m.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {m.position ?? m.jobRole}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {m.learning.courseTitleEn
                        ? pick(
                            lang,
                            m.learning.courseTitleEn,
                            m.learning.courseTitleTh,
                          )
                        : tt("Not enrolled", "ยังไม่ได้ลงทะเบียน")}
                    </td>
                    <td className="px-3 py-3">
                      <Progress value={m.learning.progress} showLabel />
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {m.learning.hours} h
                    </td>
                    <td className="px-3 py-3 font-light text-ink">
                      {m.learning.lastActivity
                        ? new Date(m.learning.lastActivity).toLocaleDateString(
                            lang === "th" ? "th-TH" : "en-GB",
                            { day: "2-digit", month: "short" },
                          )
                        : "—"}
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
          </ResponsiveTable>
        </Card>
      </section>

      {/* ------------------------------------------- add / edit a goal */}
      {goalForm ? (
        <GoalFormModal
          key={`${selected.id}:${goalForm.goal?.id ?? "new"}`}
          memberName={firstName}
          rows={selectedRows}
          courses={courses}
          goal={
            goalForm.goal
              ? {
                  competencyId: goalForm.goal.competencyId,
                  courseId: goalForm.goal.courseId,
                  fromLevel: goalForm.goal.fromLevel,
                  toLevel: goalForm.goal.toLevel,
                  activity: goalForm.goal.activity,
                  startDate: goalForm.goal.startDate,
                  dueDate: goalForm.goal.dueDate,
                  remark: goalForm.goal.remark,
                }
              : null
          }
          pending={pending}
          error={error ? errorText(error) : null}
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
              disabled={pending}
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
                `${pick(lang, pendingDelete.competencyNameEn, pendingDelete.competencyNameTh)} (level ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) via ${activityLabel(pendingDelete.activity)} will be taken off ${selected.name}'s development plan.`,
                `${pick(lang, pendingDelete.competencyNameEn, pendingDelete.competencyNameTh)} (ระดับ ${pendingDelete.fromLevel} → ${pendingDelete.toLevel}) ด้วยวิธี ${activityLabel(pendingDelete.activity)} จะถูกนำออกจากแผนพัฒนาของ ${selected.name}`,
              )}
            </p>
            <p className="mt-2">
              {tt(
                `Any course progress stays in the LMS, and ${firstName} is notified.`,
                `ความคืบหน้าของหลักสูตรยังคงอยู่ในระบบการเรียนรู้ และ ${firstName} จะได้รับการแจ้งเตือน`,
              )}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
