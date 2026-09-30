"use client";

import { useState } from "react";
import { Card, PageHeading, Tabs } from "@/components/ui";
import { CountTile } from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import { EmployeesTab } from "@/components/admin/EmployeesTab";
import { JobRolesTab } from "@/components/admin/JobRolesTab";
import { OrgTab } from "@/components/admin/OrgTab";
import { CareerPathCard } from "@/components/admin/CareerPathCard";
import type {
  ActionResult,
  EmployeeAdminData,
} from "@/components/admin/content-types";
import { useT } from "@/lib/i18n";

export type EmployeeTabKey =
  | "employees"
  | "position"
  | "role"
  | "department"
  | "division";
type TabKey = EmployeeTabKey;

/**
 * Manage Employee — the staff data set plus the organisation chart it is filed
 * against, every tab writing to a real table. Login accounts sit next to it
 * in the menu, under Employee → Accounts.
 */
export function EmployeeAdminScreen({
  data,
  initialTab = "employees",
}: {
  data: EmployeeAdminData;
  initialTab?: TabKey;
}) {
  const { t, tt } = useT();
  const [tab, setTabState] = useState<TabKey>(initialTab);
  // the tab lives in the URL too, so a reload or a shared link opens the same one
  const setTab = (next: TabKey) => {
    setTabState(next);
    const url = next === "employees" ? window.location.pathname : `?tab=${next}`;
    window.history.replaceState(null, "", url);
  };
  const [result, setResult] = useState<ActionResult | null>(null);

  const { departments, divisions, positions, jobRoles, counts } = data;

  const TAB_OPTIONS: { value: TabKey; label: string }[] = [
    { value: "employees", label: tt("Employees", "พนักงาน") },
    { value: "position", label: t("label.position") },
    { value: "role", label: t("label.role") },
    { value: "department", label: t("label.department") },
    { value: "division", label: t("label.division") },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Staff records", "ข้อมูลพนักงาน")}
        subtitle={tt(
          `${counts.active} active staff across ${departments.length} departments and ${jobRoles.length} career roles.`,
          `พนักงานที่ทำงานอยู่ ${counts.active} คน ใน ${departments.length} ฝ่าย และ ${jobRoles.length} บทบาทสายอาชีพ`,
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <CountTile value={counts.active} label={tt("Active staff", "พนักงานที่ทำงานอยู่")} />
        <CountTile
          value={counts.withLogin}
          label={tt("Linked to a login", "เชื่อมกับบัญชีเข้าสู่ระบบ")}
          tone="success"
        />
        <CountTile
          value={counts.inactive}
          label={tt("Deactivated", "ปิดใช้งาน")}
          tone="ink"
        />
      </div>

      <Card>
        <div className="scroll-thin overflow-x-auto px-5 pt-5">
          <Tabs
            value={tab}
            onChange={setTab}
            options={TAB_OPTIONS}
            variant="underline"
            className="min-w-max"
          />
        </div>

        {tab === "employees" ? (
          <EmployeesTab data={data} onResult={setResult} />
        ) : null}

        {tab === "position" ? (
          <OrgTab
            entity="position"
            rows={positions}
            departments={departments}
            onResult={setResult}
          />
        ) : null}

        {tab === "role" ? (
          <JobRolesTab rows={jobRoles} onResult={setResult} />
        ) : null}

        {tab === "department" ? (
          <OrgTab
            entity="department"
            rows={departments}
            departments={departments}
            onResult={setResult}
          />
        ) : null}

        {tab === "division" ? (
          <OrgTab
            entity="division"
            rows={divisions}
            departments={departments}
            onResult={setResult}
          />
        ) : null}

      </Card>

      {tab === "role" || tab === "employees" ? (
        <div className="mt-5">
          <CareerPathCard jobRoles={jobRoles} />
        </div>
      ) : null}
    </div>
  );
}
