import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getTeamSummaries } from "@/server/competency";
import {
  getCoachingNotes,
  getCourseOptions,
  getDirectReports,
  getGoalRowsForMany,
  getNamedGapRows,
  getReviewStatus,
  getTeamLearning,
  getTeamMatrix,
  type NamedGapRow,
} from "@/server/team";
import { TeamProfileView, type TeamProfileMember } from "./TeamProfileView";

/**
 * Team Profile is gated on the permission, not on a role name: anyone whose
 * role carries `see_team_result` and has direct reports gets the screen.
 *
 * Everything for every direct report is loaded once here — the gap rows, the
 * plans, the notes, the review status — so switching member in the heat map is
 * instant and costs no further queries. `getTeamSummaries` loops
 * `getPersonSummary`, which is the right trade for a handful of reports;
 * `/reports` is the screen that has to scale, and it uses an aggregate query
 * instead.
 */
export default async function TeamProfilePage() {
  const viewer = await requirePermission(PERMISSIONS.SEE_TEAM_RESULT);

  // an admin can hold `see_team_result` without being a member of staff — there
  // is no org-chart branch under them, so the view renders its empty state
  if (!viewer.employeeId) {
    return (
      <TeamProfileView
        managerName={viewer.name}
        members={[]}
        competencies={[]}
        rowsByMember={{}}
        goalsByMember={{}}
        courses={[]}
      />
    );
  }
  const managerId = viewer.employeeId;

  const [members, summaries] = await Promise.all([
    getDirectReports(managerId),
    getTeamSummaries(managerId),
  ]);
  const memberIds = members.map((m) => m.id);
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  const [matrix, goalsByMember, notes, reviews, learning, courses, gapRows] =
    await Promise.all([
      getTeamMatrix(memberIds),
      getGoalRowsForMany(memberIds),
      getCoachingNotes(memberIds, managerId),
      getReviewStatus(managerId, memberIds),
      getTeamLearning(memberIds),
      getCourseOptions(),
      // already cached by getTeamSummaries — this only adds the Thai names
      Promise.all(memberIds.map((id) => getNamedGapRows(id))),
    ]);

  const rowsByMember = Object.fromEntries(
    memberIds.map((id, i): [string, NamedGapRow[]] => [id, gapRows[i] ?? []]),
  );

  const teamMembers: TeamProfileMember[] = members.map((m) => {
    const summary = summaryById.get(m.id);
    const learn = learning.get(m.id);
    return {
      id: m.id,
      name: m.name,
      nickname: m.nickname,
      position: m.position,
      jobRole: m.jobRole,
      level: m.level,
      skillIndex: summary?.skillIndex ?? 0,
      averageExpected: summary?.averageExpected ?? 0,
      cycleProgress: summary?.cycleProgress ?? 0,
      reviewedAt: reviews.get(m.id)?.toISOString() ?? null,
      note: notes.get(m.id) ?? "",
      cells: Object.fromEntries(matrix.cells.get(m.id) ?? new Map()),
      learning: {
        courseTitleEn: learn?.courseTitleEn ?? null,
        courseTitleTh: learn?.courseTitleTh ?? null,
        hours: learn?.hours ?? 0,
        progress: learn?.progress ?? 0,
        enrolledCount: learn?.enrolledCount ?? 0,
        completedCount: learn?.completedCount ?? 0,
        lastActivity: learn?.lastActivity?.toISOString() ?? null,
      },
    };
  });

  return (
    <TeamProfileView
      managerName={viewer.employeeName ?? viewer.name}
      members={teamMembers}
      competencies={matrix.competencies.map((c) => ({
        id: c.id,
        group: c.group,
        nameEn: c.nameEn,
        nameTh: c.nameTh,
        definitionEn: c.definitionEn,
        definitionTh: c.definitionTh,
      }))}
      rowsByMember={rowsByMember}
      goalsByMember={Object.fromEntries(goalsByMember)}
      courses={courses.map((c) => ({
        id: c.id,
        titleEn: c.titleEn,
        titleTh: c.titleTh,
        competencyId: c.competencyId,
      }))}
    />
  );
}
