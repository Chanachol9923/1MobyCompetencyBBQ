import { can, PERMISSIONS } from "@/lib/permissions";
import { requireEmployee } from "@/server/session";
import { getPersonSummary } from "@/server/competency";
import {
  getCourseByCompetency,
  getDirectReports,
  getEngagement,
  getGoalRows,
  getNamedGapRows,
  getTeamMatrix,
} from "@/server/team";
import { DashboardView, type TeamHeatRow } from "./DashboardView";

/**
 * The dashboard is a server component: it resolves who is asking from the
 * session, reads their result out of Postgres and hands plain props to the
 * client view, which owns the tabs, the charts and the navigation.
 *
 * Nothing on this screen is invented. Every tile traces back to a table —
 * scores to `AssessmentScore`, the expectation to `ExpectedLevel`, the goal
 * counter to `IdpGoal`, points and badges to `PointLedger` / `EmployeeBadge` —
 * and where a table is still empty the card says so rather than showing a
 * placeholder number.
 */
export default async function DashboardPage() {
  const viewer = await requireEmployee();

  const [rows, summary, goals, engagement, courseByCompetency] =
    await Promise.all([
      getNamedGapRows(viewer.employeeId),
      getPersonSummary(viewer.employeeId),
      getGoalRows(viewer.employeeId),
      getEngagement(viewer.employeeId),
      getCourseByCompetency(),
    ]);

  /* ------------------------------------------------- the team heat map */
  const showTeam =
    can(viewer.permissions, PERMISSIONS.SEE_TEAM_RESULT) &&
    viewer.reportIds.length > 0;

  const members = showTeam ? await getDirectReports(viewer.employeeId) : [];
  const matrix = members.length
    ? await getTeamMatrix(members.map((m) => m.id))
    : null;

  const team: TeamHeatRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    position: m.position,
    cells: Object.fromEntries(matrix?.cells.get(m.id) ?? new Map()),
  }));

  return (
    <DashboardView
      name={viewer.employeeName ?? viewer.name}
      position={summary?.position ?? summary?.jobRole ?? ""}
      level={summary?.level ?? ""}
      rows={rows}
      skillIndex={summary?.skillIndex ?? 0}
      averageExpected={summary?.averageExpected ?? 0}
      cycleProgress={summary?.cycleProgress ?? 0}
      goals={goals}
      points={engagement.points}
      badges={engagement.badges.map((b) => ({
        key: b.badge.key,
        nameEn: b.badge.nameEn,
        nameTh: b.badge.nameTh,
        points: b.badge.points,
        tone: b.badge.tone,
        earnedAt: b.earnedAt,
      }))}
      courses={[...courseByCompetency.entries()].map(([competencyId, c]) => ({
        competencyId,
        slug: c.slug,
        titleEn: c.titleEn,
        titleTh: c.titleTh,
      }))}
      team={team}
      teamCompetencies={(matrix?.competencies ?? []).map((c) => ({
        id: c.id,
        group: c.group,
        nameEn: c.nameEn,
        nameTh: c.nameTh,
        definitionEn: c.definitionEn,
        definitionTh: c.definitionTh,
      }))}
    />
  );
}
