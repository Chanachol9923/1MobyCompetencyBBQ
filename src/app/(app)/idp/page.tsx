import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import { getIdpView } from "@/server/learning";
import { IdpView } from "./IdpView";

export const metadata: Metadata = { title: "IDP · 1Moby" };

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
 */
export default async function IdpPage() {
  const viewer = await requireEmployee();
  const { goals, certificates, assessedGroups } = await getIdpView(
    viewer.employeeId,
  );

  return (
    <IdpView
      goals={goals}
      certificates={certificates}
      assessedGroups={assessedGroups}
    />
  );
}
