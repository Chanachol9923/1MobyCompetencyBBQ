"use client";

import { useMemo, useState } from "react";
import { Card, PageHeading, Tabs } from "@/components/ui";
import { AdminOnly } from "@/components/admin/shared";
import { EmployeesTab } from "@/components/admin/EmployeesTab";
import { CareerPathCard } from "@/components/admin/CareerPathCard";
import { OrgTab, type OrgField, type OrgRow } from "@/components/admin/OrgTab";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import {
  DEPARTMENTS,
  DIVISIONS,
  JOB_ROLES,
  POSITIONS,
  STAFF,
} from "@/data/people";
import { useT } from "@/lib/i18n";

export default function ManageEmployeePage() {
  return (
    <AdminOnly>
      <ManageEmployee />
    </AdminOnly>
  );
}

type TabKey =
  | "employees"
  | "position"
  | "role"
  | "department"
  | "division"
  | "permissions";

const DEPT_NAMES = DEPARTMENTS.map((d) => d.name);
const LEVEL_NAMES = Array.from(new Set(JOB_ROLES.map((r) => r.level)));

function seedPositions(): OrgRow[] {
  return POSITIONS.map((p) => ({
    id: p.id,
    name: p.name,
    department: p.department,
    headcount: p.headcount,
  }));
}

function seedRoles(): OrgRow[] {
  return JOB_ROLES.map((r) => ({
    id: r.id,
    name: r.name,
    level: r.level,
    grade: r.grade,
    members: STAFF.filter((p) => p.jobRole === r.name).length,
  }));
}

function seedDepartments(): OrgRow[] {
  return DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    employees: d.employees,
    assessed: d.assessed,
    progress: d.progress,
    status: d.status,
  }));
}

function seedDivisions(): OrgRow[] {
  return DIVISIONS.map((d) => ({
    id: d.id,
    name: d.name,
    department: d.department,
    employees: d.employees,
  }));
}

function ManageEmployee() {
  const { t, tt } = useT();
  const [tab, setTab] = useState<TabKey>("employees");
  const [positions, setPositions] = useState<OrgRow[]>(seedPositions);
  const [roles, setRoles] = useState<OrgRow[]>(seedRoles);
  const [departments, setDepartments] = useState<OrgRow[]>(seedDepartments);
  const [divisions, setDivisions] = useState<OrgRow[]>(seedDivisions);

  const TAB_OPTIONS: { value: TabKey; label: string }[] = [
    { value: "employees", label: tt("Employees", "พนักงาน") },
    { value: "position", label: t("label.position") },
    { value: "role", label: t("label.role") },
    { value: "department", label: t("label.department") },
    { value: "division", label: t("label.division") },
    { value: "permissions", label: tt("Roles & permissions", "สิทธิ์การใช้งาน") },
  ];

  const POSITION_FIELDS: OrgField[] = useMemo(
    () => [
      { key: "name", label: t("label.position") },
      {
        key: "department",
        label: t("label.department"),
        type: "select",
        options: DEPT_NAMES,
      },
      { key: "headcount", label: t("label.headcount"), type: "number" },
    ],
    [t],
  );

  const ROLE_FIELDS: OrgField[] = useMemo(
    () => [
      { key: "name", label: t("label.role") },
      { key: "level", label: t("label.level"), type: "select", options: LEVEL_NAMES },
      { key: "grade", label: t("label.grade") },
      { key: "members", label: t("label.headcount"), type: "number" },
    ],
    [t],
  );

  const DEPARTMENT_FIELDS: OrgField[] = useMemo(
    () => [
      { key: "name", label: t("label.department") },
      { key: "employees", label: t("label.headcount"), type: "number" },
      { key: "assessed", label: tt("Assessed", "ประเมินแล้ว") },
      { key: "progress", label: t("label.progress"), type: "number" },
      {
        key: "status",
        label: t("label.status"),
        type: "select",
        options: ["On Track", "Complete", "Needs Follow-Up"],
      },
    ],
    [t, tt],
  );

  const DIVISION_FIELDS: OrgField[] = useMemo(
    () => [
      { key: "name", label: t("label.division") },
      {
        key: "department",
        label: t("label.department"),
        type: "select",
        options: DEPT_NAMES,
      },
      { key: "employees", label: t("label.headcount"), type: "number" },
    ],
    [t],
  );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage Employee", "จัดการพนักงาน")}
        subtitle={tt(
          `${STAFF.length} staff in the organisation, plus the HROD system account.`,
          `พนักงาน ${STAFF.length} คนในองค์กร และบัญชีผู้ดูแลระบบฝ่ายบุคคล`,
        )}
      />

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

        {tab === "employees" ? <EmployeesTab /> : null}

        {tab === "position" ? (
          <OrgTab
            entity="position"
            noun={t("label.position")}
            addLabel={tt("Create New Position", "สร้างตำแหน่งใหม่")}
            fields={POSITION_FIELDS}
            rows={positions}
            onChange={setPositions}
            filterKey="department"
            filterLabel={t("label.department")}
          />
        ) : null}

        {tab === "role" ? (
          <OrgTab
            entity="role"
            noun={t("label.role")}
            addLabel={tt("Create New Role", "สร้างบทบาทใหม่")}
            fields={ROLE_FIELDS}
            rows={roles}
            onChange={setRoles}
            filterKey="level"
            filterLabel={t("label.level")}
          />
        ) : null}

        {tab === "department" ? (
          <OrgTab
            entity="department"
            noun={t("label.department")}
            addLabel={tt("Create New Department", "สร้างฝ่ายใหม่")}
            fields={DEPARTMENT_FIELDS}
            rows={departments}
            onChange={setDepartments}
            filterKey="status"
            filterLabel={t("label.status")}
          />
        ) : null}

        {tab === "division" ? (
          <OrgTab
            entity="division"
            noun={t("label.division")}
            addLabel={tt("Add New Division", "เพิ่มแผนกใหม่")}
            fields={DIVISION_FIELDS}
            rows={divisions}
            onChange={setDivisions}
            filterKey="department"
            filterLabel={t("label.department")}
          />
        ) : null}

        {/* The matrix moved to its own screen when it stopped being a mock-up:
            it now writes RolePermission rows, so it belongs next to the role
            list rather than buried in a tab about employees. */}
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
          <CareerPathCard />
        </div>
      ) : null}
    </div>
  );
}
