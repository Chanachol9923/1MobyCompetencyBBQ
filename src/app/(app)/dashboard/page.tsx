"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, User } from "lucide-react";
import { Button, Card, Pill, Progress, Stat, Tabs } from "@/components/ui";
import { BadgeTile } from "@/components/profile/BadgeTile";
import { HeatMapTable } from "@/components/profile/HeatMapTable";
import { RadarPanel } from "@/components/profile/RadarPanel";
import { SkillPointsList } from "@/components/profile/SkillPointsList";
import { StrengthsPanel } from "@/components/profile/StrengthsPanel";
import { VerdictPill } from "@/components/profile/VerdictPill";
import {
  expectedAverageFor,
  formatGap,
  gapRows,
  groupsFor,
  heatValue,
  overallFor,
  radarRowsFor,
  verdictCounts,
  type GapRow,
} from "@/components/profile/gap";
import {
  COMPETENCIES,
  GROUP_LABEL,
  GROUP_LABEL_TH,
  assessedFor,
  expectedFor,
  verdictFor,
  type Group,
} from "@/data/competencies";
import { directReportsOf } from "@/data/people";
import { BADGES } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { goalIsComplete, goalProgress, useDemo } from "@/lib/store";

export default function DashboardPage() {
  const { state, person } = useDemo();
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);

  /** Only the groups this person's job role is actually assessed on. */
  const groups = useMemo<Group[]>(
    () => (person ? groupsFor(person) : []),
    [person],
  );
  const activeGroup = group && groups.includes(group) ? group : groups[0]!;

  const team = useMemo(
    () => (person ? directReportsOf(person.id) : []),
    [person],
  );
  const earned = useMemo(() => BADGES.filter((b) => b.earned).slice(0, 2), []);

  /**
   * Heat map columns follow the group tab, but only the competencies at least
   * one team member is actually assessed on — no all-N/A columns.
   */
  const heatCompetencies = useMemo(() => {
    const ids = new Set<string>();
    team.forEach((m) =>
      assessedFor(m.jobRole, activeGroup).forEach((c) => ids.add(c.id)),
    );
    return COMPETENCIES.filter(
      (c) => c.group === activeGroup && ids.has(c.id),
    );
  }, [team, activeGroup]);

  const rows = useMemo<GapRow[]>(
    () => (person && activeGroup ? gapRows(state, person, activeGroup) : []),
    [state, person, activeGroup],
  );
  const allRows = useMemo<GapRow[]>(
    () => (person ? gapRows(state, person) : []),
    [state, person],
  );

  if (!person || !state.personId) return null;

  const personId = state.personId;
  const isManager = state.role === "l2" && team.length > 0;
  const radar = radarRowsFor(state, person, activeGroup);
  const goals = state.idp[personId] ?? [];
  const goalsDone = goals.filter((g) => goalIsComplete(state, g)).length;

  const overall = overallFor(state, person);
  const expectedAvg = expectedAverageFor(state, person);
  const overallGap = Number((overall - expectedAvg).toFixed(2));
  const counts = verdictCounts(allRows);
  const selfAvg = allRows.length
    ? Number(
        (allRows.reduce((a, r) => a + r.self, 0) / allRows.length).toFixed(2),
      )
    : 0;

  const groupLabel = (g: Group) =>
    lang === "th" ? GROUP_LABEL_TH[g] : GROUP_LABEL[g];

  return (
    <div className="pb-12">
      {/* -------------------------------------------------------- hero banner */}
      <section className="bg-[linear-gradient(100deg,#0b1b3f_0%,#00306e_42%,#006bff_100%)] px-6 pb-16 pt-8 lg:px-10">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/20 text-white lg:size-16">
            <User size={32} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-medium text-white lg:text-4xl">
              {person.name}
            </h1>
            <p className="mt-0.5 truncate text-sm font-light text-white/90 lg:text-lg">
              {person.position} ({person.level})
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- page content */}
      <div className="mx-auto -mt-10 max-w-[1200px] space-y-6 px-6 lg:px-10">
        {/* stat cards overlapping the hero */}
        <div className="grid items-stretch gap-6 sm:grid-cols-3">
          <Stat
            label={tt("Overall score (manager)", "คะแนนรวม (หัวหน้าประเมิน)")}
            value={overall.toFixed(2)}
            delta={`${t("label.expected")} ${expectedAvg.toFixed(2)}`}
            tone={overallGap < 0 ? "amber" : "success"}
          />
          <Stat
            label={tt("Self vs manager", "ประเมินตนเองเทียบหัวหน้า")}
            value={`${selfAvg.toFixed(2)} / ${overall.toFixed(2)}`}
            delta={formatGap(Number((overall - selfAvg).toFixed(2)))}
            tone="brand"
          />
          <Stat
            label={tt("Goals met", "เป้าหมายที่สำเร็จ")}
            value={`${goalsDone}/${goals.length}`}
            delta={`${counts.critical + counts.development} ${tt("gaps", "ช่องว่าง")}`}
          />
        </div>

        {/* --------------------------------------------- competency main card */}
        <Card className="p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              variant="dark"
              value={activeGroup}
              onChange={setGroup}
              options={groups.map((g) => ({ value: g, label: groupLabel(g) }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">
                {t("label.gap")} {formatGap(overallGap)}
              </Pill>
              <VerdictPill verdict={verdictFor(overallGap)} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/reports")}
              >
                <BarChart3 size={14} />
                {tt("View full report", "ดูรายงานฉบับเต็ม")}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid items-stretch gap-8 lg:grid-cols-2">
            <RadarPanel
              data={radar}
              height={300}
              label={groupLabel(activeGroup)}
              fill
            />
            <SkillPointsList rows={rows} fill />
          </div>

          <p className="mt-5 text-xs text-muted">
            {tt(
              "Manager score is the official result; the self column is the employee's own rating. Competencies this role is not assessed on are not shown.",
              "คะแนนจากหัวหน้าคือผลการประเมินอย่างเป็นทางการ ส่วนคอลัมน์ประเมินตนเองคือคะแนนที่พนักงานให้ตนเอง สมรรถนะที่ตำแหน่งนี้ไม่ถูกประเมินจะไม่แสดง",
            )}
          </p>
        </Card>

        {/* ------------------------- automatic strengths / development areas */}
        <StrengthsPanel rows={allRows} goals={goals} />

        {/* ------------------------------------------------------- bottom grid */}
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          {/* achievements */}
          <section className="flex min-w-0 flex-col">
            <h2 className="mb-4 text-lg text-ink">{t("nav.achievements")}</h2>
            <Card className="flex flex-1 items-center p-5">
              <div className="grid w-full grid-cols-2 gap-5">
                {earned.map((b) => (
                  <BadgeTile key={b.id} badge={b} />
                ))}
              </div>
            </Card>
            <Button
              className="mt-4 min-h-12 w-full py-3 text-base font-bold"
              onClick={() => router.push("/achievements")}
            >
              {t("action.viewMore")}
            </Button>
          </section>

          {/* manager: heat map — employee: development plan */}
          <section className="flex min-w-0 flex-col">
            <h2 className="mb-4 text-lg text-ink">
              {isManager
                ? tt("Team Competency Heat map", "แผนภาพความร้อนสมรรถนะทีม")
                : tt("My Development Plan", "แผนพัฒนาของฉัน")}
            </h2>
            <Card className="flex flex-1 flex-col p-4">
              {isManager ? (
                <HeatMapTable
                  className="flex-1"
                  members={team}
                  competencies={heatCompetencies}
                  scoreOf={(pid, cid) => {
                    const m = team.find((x) => x.id === pid);
                    return m ? heatValue(state, m, cid) : null;
                  }}
                  expectedOf={(pid, cid) => {
                    const m = team.find((x) => x.id === pid);
                    return m ? expectedFor(m.jobRole, cid) : null;
                  }}
                />
              ) : (
                <ul className="flex flex-1 flex-col justify-between gap-3">
                  {goals.slice(0, 4).map((g) => (
                    <li
                      key={g.id}
                      className="rounded-lg border border-line/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full bg-accent" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                          {g.competencyName}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {Math.round(goalProgress(state, g))}%
                        </span>
                      </div>
                      <p className="mt-0.5 truncate pl-[18px] text-xs text-muted">
                        {tt(
                          `Level ${g.fromLevel} → ${g.toLevel} · ${g.courseTitle}`,
                          `ระดับ ${g.fromLevel} → ${g.toLevel} · ${g.courseTitle}`,
                        )}
                      </p>
                      <Progress
                        className="mt-2"
                        tone="amber"
                        value={goalProgress(state, g)}
                      />
                    </li>
                  ))}
                  {goals.length === 0 ? (
                    <li className="py-8 text-center text-sm text-muted">
                      {tt(
                        "Your manager has not set a development plan yet.",
                        "หัวหน้ายังไม่ได้กำหนดแผนพัฒนาให้คุณ",
                      )}
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>
            <Button
              className="mt-4 min-h-12 w-full py-3 text-base font-bold"
              onClick={() => router.push(isManager ? "/team-profile" : "/idp")}
            >
              {t("action.viewMore")}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
