"use client";

import { useState } from "react";
import { UsersScreen } from "@/components/admin/UsersScreen";
import type { UsersScreenData } from "@/components/admin/admin-types";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Card, PageHeading, Tabs } from "@/components/ui";
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
  | "accounts"
  | "position"
  | "role"
  | "department"
  | "division"
  | "permissions";
type TabKey = EmployeeTabKey;

/**
 * Manage Employee — the staff data set plus the organisation chart it is filed
 * against, every tab writing to a real table.
 *
 * The permissions tab is deliberately a signpost: the matrix became a persisted
 * screen of its own once it started writing `RolePermission` rows, and it
 * belongs next to the role list rather than buried in a tab about employees.
 */
export function EmployeeAdminScreen({
  data,
  accounts,
  initialTab = "employees",
}: {
  data: EmployeeAdminData;
  accounts: UsersScreenData;
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
    {
      value: "accounts",
      label:
        accounts.counts.withoutAccount > 0
          ? tt(
              `Accounts (${accounts.counts.withoutAccount} without)`,
              `บัญชีผู้ใช้ (ยังไม่มี ${accounts.counts.withoutAccount})`,
            )
          : tt("Accounts", "บัญชีผู้ใช้"),
    },
    { value: "position", label: t("label.position") },
    { value: "role", label: t("label.role") },
    { value: "department", label: t("label.department") },
    { value: "division", label: t("label.division") },
    { value: "permissions", label: tt("Roles & permissions", "สิทธิ์การใช้งาน") },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage Employee", "จัดการพนักงาน")}
        subtitle={tt(
          `${counts.active} active staff across ${departments.length} departments and ${jobRoles.length} career roles.`,
          `พนักงานที่ทำงานอยู่ ${counts.active} คน ใน ${departments.length} ฝ่าย และ ${jobRoles.length} บทบาทสายอาชีพ`,
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {tab !== "accounts" ? (
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
      ) : null}

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

        {tab === "accounts" ? (
          <div className="p-5">
            <UsersScreen data={accounts} embedded />
          </div>
        ) : null}

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

        {tab === "permissions" ? (
          <div className="p-5">
            <div className="rounded-xl border border-line/70 bg-surface/60 p-5">
              <h3 className="text-base font-bold text-ink">
                {tt("Roles & permissions moved", "ย้ายหน้าบทบาทและสิทธิ์แล้ว")}
              </h3>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                {tt(
                  "The permission matrix is a real, persisted screen now — every switch writes to the database and takes effect for signed-in users within five minutes.",
                  "ตารางสิทธิ์เป็นหน้าจริงที่บันทึกลงฐานข้อมูลแล้ว การสลับสวิตช์แต่ละครั้งจะถูกบันทึกและมีผลกับผู้ใช้ที่เข้าสู่ระบบอยู่ภายใน 5 นาที",
                )}
              </p>
              <Link href="/admin/roles" className="mt-4 inline-block">
                <Button>
                  {tt("Open Roles & permissions", "ไปที่บทบาทและสิทธิ์")}
                  <ArrowRight size={15} />
                </Button>
              </Link>
            </div>
          </div>
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
