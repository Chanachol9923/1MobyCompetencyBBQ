import { redirect } from "next/navigation";
import { can, PERMISSIONS } from "@/lib/permissions";
import { requireViewer } from "@/server/session";
import { getOrgFilters, getScopeReport, PEOPLE_LIMIT } from "@/server/team";
import { ReportsView, type Scope } from "./ReportsView";

/**
 * Gap Analysis Report.
 *
 * Scope is decided by permission, never by a role name:
 *   - anyone linked to a staff record sees their own result;
 *   - `see_team_result` adds the direct-report scope;
 *   - `see_company_report` adds the organisation scope and its filters.
 *
 * The whole report — verdict counts, the bar chart, the gap table, the
 * generated read and the CSV — is built from one aggregate query per scope in
 * `getScopeReport`. The browser receives one row per competency and a bounded
 * slice of people, never a row per employee, so a company of any size costs the
 * same three round trips as a team of six.
 */
type Search = { scope?: string; dept?: string; div?: string };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;

  const scopes: Scope[] = [];
  if (viewer.employeeId) scopes.push("me");
  if (can(viewer.permissions, PERMISSIONS.SEE_TEAM_RESULT) && viewer.reportIds.length) {
    scopes.push("team");
  }
  if (can(viewer.permissions, PERMISSIONS.SEE_COMPANY_REPORT)) scopes.push("company");
  if (scopes.length === 0) redirect("/forbidden");

  const requested = params.scope as Scope | undefined;
  const scope: Scope =
    requested && scopes.includes(requested) ? requested : scopes[0]!;

  const orgFilters = scopes.includes("company")
    ? await getOrgFilters()
    : { departments: [], divisions: [] };

  // only the company scope carries filters, and only ids that really exist
  const departmentId =
    scope === "company" &&
    params.dept &&
    orgFilters.departments.some((d) => d.id === params.dept)
      ? params.dept
      : null;
  const divisionId =
    scope === "company" &&
    params.div &&
    orgFilters.divisions.some(
      (d) => d.id === params.div && (!departmentId || d.departmentId === departmentId),
    )
      ? params.div
      : null;

  const report = await getScopeReport(
    scope === "company"
      ? { kind: "company", departmentId, divisionId }
      : {
          kind: "people",
          employeeIds:
            scope === "team"
              ? viewer.reportIds
              : viewer.employeeId
                ? [viewer.employeeId]
                : [],
        },
  );

  return (
    <ReportsView
      scope={scope}
      scopes={scopes}
      departments={orgFilters.departments.map((d) => ({
        id: d.id,
        name: d.name,
        employees: d._count.employees,
      }))}
      divisions={orgFilters.divisions}
      departmentId={departmentId}
      divisionId={divisionId}
      headcount={report.headcount}
      rows={report.rows}
      people={report.people}
      peopleTruncated={report.peopleTruncated}
      peopleLimit={PEOPLE_LIMIT}
      canSeeTeam={scopes.includes("team")}
      canWorkIdp={can(viewer.permissions, PERMISSIONS.WORK_OWN_IDP)}
    />
  );
}
