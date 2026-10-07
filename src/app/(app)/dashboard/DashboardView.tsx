"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, User } from "lucide-react";
import { Button, Card, Pill, Progress, Stat, Tabs } from "@/components/ui";
import { BadgeTile, type EarnedBadge } from "@/components/profile/BadgeTile";
import {
  HeatMapTable,
  type HeatCompetency,
} from "@/components/profile/HeatMapTable";
import { RadarPanel } from "@/components/profile/RadarPanel";
import { SkillPointsList } from "@/components/profile/SkillPointsList";
import {
  StrengthsPanel,
  type CourseHint,
} from "@/components/profile/StrengthsPanel";
import { VerdictPill } from "@/components/profile/VerdictPill";
import {
  COMPETENCY_GROUPS,
  formatGap,
  groupDictKey,
  pick,
  toRadarData,
  verdictCounts,
  verdictFor,
  type CompetencyGroup,
  type GapRow,
} from "@/components/profile/gap";
import { useT } from "@/lib/i18n";

/** A heat-map row: the member plus their cells, keyed by competency id. */
export type TeamHeatRow = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
  cells: Record<
    string,
    { expected: number | null; self: number | null; manager: number | null; score: number | null }
  >;
};

export type DashboardGoal = {
  id: string;
  competencyId: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  courseTitleEn: string | null;
  courseTitleTh: string | null;
  fromLevel: number;
  toLevel: number;
  progress: number;
  complete: boolean;
};

type GroupedCompetency = HeatCompetency & { group: CompetencyGroup };

const round2 = (n: number) => Number(n.toFixed(2));

const average = (xs: number[]) =>
  xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

export function DashboardView({
  name,
  position,
  level,
  rows,
  skillIndex,
  averageExpected,
  cycleProgress,
  goals,
  points,
  badges,
  courses,
  team,
  teamCompetencies,
}: {
  name: string;
  position: string;
  level: string;
  rows: GapRow[];
  skillIndex: number;
  averageExpected: number;
  cycleProgress: number;
  goals: DashboardGoal[];
  points: number;
  badges: EarnedBadge[];
  courses: CourseHint[];
  team: TeamHeatRow[];
  teamCompetencies: GroupedCompetency[];
}) {
  const { t, tt, lang, lv } = useT();
  const router = useRouter();
  const [group, setGroup] = useState<CompetencyGroup | null>(null);

  /** Only the groups this person's career role is actually assessed on. */
  const groups = useMemo(
    () => COMPETENCY_GROUPS.filter((g) => rows.some((r) => r.group === g)),
    [rows],
  );
  const activeGroup = group && groups.includes(group) ? group : groups[0];

  const groupRows = useMemo(
    () => (activeGroup ? rows.filter((r) => r.group === activeGroup) : []),
    [rows, activeGroup],
  );

  const radar = useMemo(
    () => toRadarData(groupRows, lang),
    [groupRows, lang],
  );

  /** Heat map columns follow the group tab. */
  const heatCompetencies = useMemo(
    () => teamCompetencies.filter((c) => c.group === activeGroup),
    [teamCompetencies, activeGroup],
  );

  const isManager = team.length > 0;

  const overallGap = round2(skillIndex - averageExpected);
  const counts = verdictCounts(rows.filter((r) => r.score !== null));
  const selfAvg = average(
    rows.filter((r) => r.self !== null).map((r) => r.self!),
  );
  const managerAvg = average(
    rows.filter((r) => r.manager !== null).map((r) => r.manager!),
  );
  const goalsDone = goals.filter((g) => g.complete).length;

  const groupLabel = (g: CompetencyGroup) => t(groupDictKey(g));

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
              {name}
            </h1>
            <p className="mt-0.5 truncate text-sm font-light text-white/90 lg:text-lg">
              {position}
              {level ? ` (${lv(level)})` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- page content */}
      <div className="mx-auto -mt-10 max-w-[1200px] space-y-6 px-6 lg:px-10">
        {/* stat cards overlapping the hero */}
        <div className="grid items-stretch gap-6 sm:grid-cols-3">
          <Stat
            label={tt("Overall score", "คะแนนรวม")}
            value={skillIndex.toFixed(2)}
            delta={`${t("label.expected")} ${averageExpected.toFixed(2)}`}
            tone={overallGap < 0 ? "amber" : "success"}
          />
          <Stat
            label={tt("Self vs manager", "ประเมินตนเองเทียบหัวหน้า")}
            value={`${selfAvg.toFixed(2)} / ${managerAvg.toFixed(2)}`}
            delta={formatGap(round2(managerAvg - selfAvg))}
            tone="brand"
          />
          <Stat
            label={
              goals.length
                ? tt("Goals met", "เป้าหมายที่สำเร็จ")
                : tt("Cycle completed", "ความคืบหน้ารอบประเมิน")
            }
            value={
              goals.length ? `${goalsDone}/${goals.length}` : `${cycleProgress}%`
            }
            delta={`${counts.critical + counts.development} ${tt("gaps", "ช่องว่าง")}`}
          />
        </div>

        {/* --------------------------------------------- competency main card */}
        <Card className="p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {activeGroup ? (
              <Tabs
                variant="dark"
                value={activeGroup}
                onChange={setGroup}
                options={groups.map((g) => ({ value: g, label: groupLabel(g) }))}
              />
            ) : (
              <p className="text-sm text-muted">
                {tt("No competencies are set for your career role yet.",
                  "บทบาทสายอาชีพของคุณยังไม่มีสมรรถนะที่กำหนดไว้",
                )}
              </p>
            )}
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
              label={activeGroup ? groupLabel(activeGroup) : undefined}
              fill
            />
            <SkillPointsList rows={groupRows} fill />
          </div>

          <p className="mt-5 text-xs text-muted">
            {tt("The manager's score is the official result; Self is your own rating. Competencies your role is not assessed on are hidden.",
              "คะแนนจากหัวหน้าคือผลอย่างเป็นทางการ ส่วน “ตนเอง” คือคะแนนที่คุณให้ตัวเอง สมรรถนะที่บทบาทของคุณไม่ได้ประเมินจะไม่แสดง",
            )}
          </p>
        </Card>

        {/* ------------------------- automatic strengths / development areas */}
        <StrengthsPanel
          rows={rows}
          goals={goals.map((g) => ({
            competencyId: g.competencyId,
            titleEn: g.courseTitleEn ?? g.competencyNameEn,
            titleTh: g.courseTitleTh ?? g.competencyNameTh,
          }))}
          courses={courses}
        />

        {/* ------------------------------------------------------- bottom grid */}
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          {/* achievements */}
          <section className="flex min-w-0 flex-col">
            <h2 className="mb-4 text-lg text-ink">{t("nav.achievements")}</h2>
            <Card className="flex flex-1 items-center p-5">
              {badges.length ? (
                <div className="grid w-full grid-cols-2 gap-5">
                  {badges.slice(0, 2).map((b) => (
                    <BadgeTile key={b.key} badge={b} />
                  ))}
                </div>
              ) : (
                <div className="w-full text-center">
                  <p className="text-3xl font-bold text-brand">
                    {points.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted">{t("label.points")}</p>
                  <p className="mt-3 text-xs text-muted">
                    {tt(
                      "No badges earned yet — finish a course or an assessment to unlock the first one.",
                      "ยังไม่ได้รับเหรียญตรา เรียนจบหลักสูตรหรือทำการประเมินให้เสร็จเพื่อรับเหรียญแรก",
                    )}
                  </p>
                </div>
              )}
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
                ? tt("Team competency heat map", "ฮีตแมปสมรรถนะของทีม")
                : tt("My development plan", "แผนพัฒนาของฉัน")}
            </h2>
            <Card className="flex flex-1 flex-col p-4">
              {isManager ? (
                <HeatMapTable
                  className="flex-1"
                  members={team}
                  competencies={heatCompetencies}
                  scoreOf={(id, cid) =>
                    team.find((m) => m.id === id)?.cells[cid]?.score ?? null
                  }
                  expectedOf={(id, cid) =>
                    team.find((m) => m.id === id)?.cells[cid]?.expected ?? null
                  }
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
                          {pick(lang, g.competencyNameEn, g.competencyNameTh)}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {g.progress}%
                        </span>
                      </div>
                      <p className="mt-0.5 truncate pl-[18px] text-xs text-muted">
                        {tt(
                          `Level ${g.fromLevel} → ${g.toLevel}`,
                          `ระดับ ${g.fromLevel} → ${g.toLevel}`,
                        )}
                        {g.courseTitleEn
                          ? ` · ${pick(lang, g.courseTitleEn, g.courseTitleTh)}`
                          : ""}
                      </p>
                      <Progress className="mt-2" tone="amber" value={g.progress} />
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
