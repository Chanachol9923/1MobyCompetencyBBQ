import { notFound, redirect } from "next/navigation";
import { AssessmentWizard } from "@/components/assessment/AssessmentWizard";
import { NoCycleNotice } from "@/components/assessment/NoCycleNotice";
import { can, PERMISSIONS } from "@/lib/permissions";
import { requireEmployee } from "@/server/session";
import { getWizardData, isMode } from "@/server/assessment";

/**
 * One run of the 180° assessment.
 *
 * The guard is the whole point of this file. `mode` and `target` arrive from the
 * URL, which is to say from anybody, so nothing below the checks runs until the
 * server has satisfied itself that:
 *
 *   - the mode is one of exactly two — there is no peer assessment;
 *   - a self assessment is the viewer's *own* employee id, resolved from the
 *     session rather than read off the URL, and the viewer holds
 *     `run_self_assessment`;
 *   - a supervisor review is of one of the viewer's own direct reports, and the
 *     viewer holds `review_direct_reports`.
 *
 * The server actions behind the wizard repeat all of this for themselves — a
 * page guard protects the screen, not the endpoint.
 */
export default async function AssessmentRunPage({
  params,
}: {
  params: Promise<{ mode: string; target: string }>;
}) {
  const { mode: rawMode, target } = await params;
  const viewer = await requireEmployee();

  if (!isMode(rawMode)) notFound();
  const mode = rawMode;

  if (mode === "self") {
    if (!can(viewer.permissions, PERMISSIONS.RUN_SELF_ASSESSMENT)) {
      redirect("/forbidden");
    }
    // a self assessment of somebody else is not a missing page, it is a refusal
    if (target !== viewer.employeeId) redirect("/forbidden");
  } else {
    if (!can(viewer.permissions, PERMISSIONS.REVIEW_DIRECT_REPORTS)) {
      redirect("/forbidden");
    }
    if (!viewer.reportIds.includes(target)) redirect("/forbidden");
  }

  const data = await getWizardData({
    mode,
    targetId: target,
    // self answers belong to the subject; a review belongs to the manager
    reviewerId: viewer.employeeId,
  });

  // no open cycle, or the employee record vanished between the guard and here
  if (!data) return <NoCycleNotice />;

  return <AssessmentWizard data={data} />;
}
