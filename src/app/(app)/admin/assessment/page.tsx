import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getAssessmentAdminData } from "@/server/admin-content";
import { AssessmentAdminScreen } from "@/components/admin/AssessmentAdminScreen";

export const metadata: Metadata = { title: "Manage Assessment" };

export const dynamic = "force-dynamic";

/**
 * `manage_cycle` gets you onto the screen; editing the expected-level matrix
 * additionally needs `manage_framework`, which `setExpectedLevel` asserts for
 * itself. The two are separate permissions because running a cycle and redefining
 * what the company measures are separate jobs.
 */
export default async function ManageAssessmentPage() {
  await requirePermission(PERMISSIONS.MANAGE_CYCLE);
  const data = await getAssessmentAdminData();
  return <AssessmentAdminScreen data={data} />;
}
