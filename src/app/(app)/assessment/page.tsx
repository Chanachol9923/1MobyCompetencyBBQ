import { can, PERMISSIONS } from "@/lib/permissions";
import { requireEmployee } from "@/server/session";
import { getHubData } from "@/server/assessment";
import { NoCycleNotice } from "@/components/assessment/NoCycleNotice";
import { AssessmentHubView } from "./AssessmentHubView";

/**
 * The assessment hub, as a server component.
 *
 * It reads three things out of Postgres and hands them to the client view:
 * where the viewer's own self assessment has got to, where each of their direct
 * reports' reviews have got to, and — once a supervisor has actually submitted
 * one — the viewer's own weighted result.
 *
 * The supervisor section is gated on `review_direct_reports` rather than on
 * having reports: a manager whose role lost the permission keeps the team but
 * stops being asked to review it. `getHubData` takes the report ids from the
 * session, never from the browser, and rolls the whole screen up in four
 * queries however many reports there are.
 */
export default async function AssessmentPage() {
  const viewer = await requireEmployee();

  const mayReview = can(viewer.permissions, PERMISSIONS.REVIEW_DIRECT_REPORTS);

  const data = await getHubData({
    employeeId: viewer.employeeId,
    reportIds: mayReview ? viewer.reportIds : [],
  });

  const { cycle } = data;
  if (!cycle) return <NoCycleNotice showLink={false} />;

  return (
    <AssessmentHubView
      viewerId={viewer.employeeId}
      viewerName={viewer.employeeName ?? viewer.name}
      jobRoleName={viewer.jobRoleName}
      canSelfAssess={can(viewer.permissions, PERMISSIONS.RUN_SELF_ASSESSMENT)}
      data={{ ...data, cycle }}
    />
  );
}
