import type { Metadata } from "next";
import { can, PERMISSIONS } from "@/lib/permissions";
import { requireEmployee } from "@/server/session";
import { getIdpView } from "@/server/learning";
import { getCourseOptions, getNamedGapRows } from "@/server/team";
import { IdpView } from "./IdpView";

export const metadata: Metadata = { title: "IDP" };

/**
 * "แผนพัฒนารายบุคคล" — your own plan, and only ever your own.
 *
 * The employee id comes from the session, never from the URL or the client:
 * there is no way to ask this page for somebody else's plan. A manager looking
 * at a report's plan goes through Team Profile, which has its own row-level
 * check.
 *
 * Progress is read, not stored. `getIdpView` leans on `getGoalRows` in
 * `src/server/team.ts`, which turns a course-backed goal into a percentage from
 * that person's chapter completions — one definition of the rule, shared with
 * the Team Profile.
 *
 * With `work_own_idp` the owner may also add activities of their own, and edit
 * or delete only those; the gap rows and course list feed that form.
 */
export default async function IdpPage() {
  const viewer = await requireEmployee();
  const canEdit = can(viewer.permissions, PERMISSIONS.WORK_OWN_IDP);
  const [{ goals, certificates, assessedGroups }, rows, courses] =
    await Promise.all([
      getIdpView(viewer.employeeId),
      canEdit ? getNamedGapRows(viewer.employeeId) : Promise.resolve([]),
      canEdit ? getCourseOptions() : Promise.resolve([]),
    ]);

  return (
    <IdpView
      goals={goals}
      certificates={certificates}
      assessedGroups={assessedGroups}
      // a career role assessed on nothing has no gap to plan against
      canEdit={canEdit && rows.length > 0}
      rows={rows}
      courses={courses.map((c) => ({
        id: c.id,
        titleEn: c.titleEn,
        titleTh: c.titleTh,
        competencyId: c.competencyId,
      }))}
    />
  );
}
