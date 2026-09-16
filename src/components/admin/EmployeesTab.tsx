"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, KeyRound, Pencil, Power, PowerOff, Plus } from "lucide-react";
import { Avatar, Button, Field, Input, Modal, Pill, Select, Textarea } from "@/components/ui";
import {
  IconAction,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
} from "@/components/admin/shared";
import type {
  ActionResult,
  AdminEmployeeRow,
  EmployeeAdminData,
} from "@/components/admin/content-types";
import {
  createEmployee,
  setEmployeeActive,
  updateEmployee,
} from "@/server/admin-content";
import { useT } from "@/lib/i18n";

type Draft = {
  employeeCode: string;
  name: string;
  nickname: string;
  email: string;
  grade: string;
  businessUnit: string;
  remark: string;
  jobRoleId: string;
  departmentId: string;
  divisionId: string;
  positionId: string;
  managerId: string;
};

const emptyDraft = (jobRoleId: string): Draft => ({
  employeeCode: "",
  name: "",
  nickname: "",
  email: "",
  grade: "",
  businessUnit: "",
  remark: "",
  jobRoleId,
  departmentId: "",
  divisionId: "",
  positionId: "",
  managerId: "",
});

const fromRow = (p: AdminEmployeeRow): Draft => ({
  employeeCode: p.employeeCode,
  name: p.name,
  nickname: p.nickname ?? "",
  email: p.email,
  grade: p.grade ?? "",
  businessUnit: p.businessUnit ?? "",
  remark: p.remark ?? "",
  jobRoleId: p.jobRoleId,
  departmentId: p.departmentId ?? "",
  divisionId: p.divisionId ?? "",
  positionId: p.positionId ?? "",
  managerId: p.managerId ?? "",
});

/**
 * The staff data set from the requirement pack — Employee_ID, Level, Role,
 * Business Unit, Department, Division, Report to and Remark — with create, edit
 * and deactivate against the `Employee` table.
 *
 * Level is not a field here: it comes from the career role, because the career
 * role is what the expected-level matrix is keyed on. Letting the two drift
 * apart is what makes a competency framework stop meaning anything.
 */
export function EmployeesTab({
  data,
  onResult,
}: {
  data: EmployeeAdminData;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const { employees, departments, divisions, positions, jobRoles, counts } = data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<"closed" | "add" | "edit">("closed");
  const [editing, setEditing] = useState<AdminEmployeeRow | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(jobRoles[0]?.id ?? ""));
  const [confirm, setConfirm] = useState<AdminEmployeeRow | null>(null);
  const [busy, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (filter !== "all" && p.departmentId !== filter) return false;
      if (!q) return true;
      return [
        p.name,
        p.nickname ?? "",
        p.employeeCode,
        p.email,
        p.positionName ?? "",
        p.jobRoleName,
        p.level,
        p.businessUnit ?? "",
        p.departmentName ?? "",
        p.divisionName ?? "",
      ].some((v) => v.toLowerCase().includes(q));
    });
  }, [employees, query, filter, showInactive]);

  /** Only the divisions of the department currently picked in the form. */
  const draftDivisions = useMemo(
    () => divisions.filter((d) => !draft.departmentId || d.parentId === draft.departmentId),
    [divisions, draft.departmentId],
  );

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => onResult(await fn()));
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft(jobRoles[0]?.id ?? ""));
    setEditing(null);
    setMode("add");
  }

  function openEdit(p: AdminEmployeeRow) {
    setDraft(fromRow(p));
    setEditing(p);
    setMode("edit");
  }

  function save() {
    const payload = { ...draft };
    const target = editing;
    setMode("closed");
    run(() =>
      target
        ? updateEmployee({ ...payload, employeeId: target.id })
        : createEmployee(payload),
    );
  }

  function exportList() {
    downloadCsv(
      "1moby-employee-list.csv",
      [
        t("label.employeeId"),
        t("label.name"),
        t("label.nickname"),
        t("label.email"),
        t("label.level"),
        t("label.role"),
        t("label.position"),
        t("label.grade"),
        t("label.businessUnit"),
        t("label.department"),
        t("label.division"),
        t("label.reportTo"),
        t("label.remark"),
      ],
      visible.map((p) => [
        p.employeeCode,
        p.name,
        p.nickname ?? "",
        p.email,
        p.level,
        p.jobRoleName,
        p.positionName ?? "",
        p.grade ?? "",
        p.businessUnit ?? "",
        p.departmentName ?? "",
        p.divisionName ?? "",
        p.managerName ?? "",
        p.remark ?? "",
      ]),
    );
  }

  const levelOfDraftRole =
    jobRoles.find((r) => r.id === draft.jobRoleId)?.level ?? "—";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("admin.searchEmployee")}
          className="w-full sm:w-64"
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-56"
          aria-label={t("label.department")}
        >
          <option value="all">{t("label.all")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted max-lg:min-h-11">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 accent-[#006bff]"
          />
          {tt(
            `Show deactivated (${counts.inactive})`,
            `แสดงที่ปิดใช้งาน (${counts.inactive})`,
          )}
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            <Download size={14} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
          <Button size="sm" onClick={openAdd} disabled={jobRoles.length === 0}>
            <Plus size={15} />
            {tt("Add New Employees", "เพิ่มพนักงานใหม่")}
          </Button>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[1400px] border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th>{t("label.employee")}</Th>
              <Th>{t("label.employeeId")}</Th>
              <Th>{t("label.level")}</Th>
              <Th>{t("label.role")}</Th>
              <Th>{t("label.position")}</Th>
              <Th>{t("label.grade")}</Th>
              <Th>{t("label.businessUnit")}</Th>
              <Th>{t("label.department")}</Th>
              <Th>{t("label.division")}</Th>
              <Th>{t("label.reportTo")}</Th>
              <Th>{t("label.remark")}</Th>
              <Th className="text-right">{t("label.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size={32} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-bold">
                        {p.name}
                        {p.hasLogin ? (
                          <KeyRound
                            size={11}
                            className="shrink-0 text-brand"
                            aria-label={tt("Has a login", "มีบัญชีเข้าสู่ระบบ")}
                          />
                        ) : null}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {p.nickname ?? p.email}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td className="font-bold">{p.employeeCode}</Td>
                <Td className="whitespace-nowrap text-muted">{p.level}</Td>
                <Td className="font-bold">{p.jobRoleName}</Td>
                <Td className="text-muted">{p.positionName ?? "—"}</Td>
                <Td className="text-muted">{p.grade ?? "—"}</Td>
                <Td className="text-muted">{p.businessUnit ?? "—"}</Td>
                <Td className="font-bold">{p.departmentName ?? "—"}</Td>
                <Td className="max-w-[220px] text-muted">{p.divisionName ?? "—"}</Td>
                <Td className="whitespace-nowrap text-muted">
                  {p.managerName ?? "—"}
                  {p.reportCount ? (
                    <span className="ml-1 text-[10px] text-brand">
                      {tt(`(+${p.reportCount})`, `(+${p.reportCount})`)}
                    </span>
                  ) : null}
                </Td>
                <Td className="max-w-[180px] text-muted">
                  {p.active ? (
                    (p.remark ?? "—")
                  ) : (
                    <Pill tone="neutral">{tt("Deactivated", "ปิดใช้งาน")}</Pill>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <IconAction
                      tone="brand"
                      aria-label={`${t("action.edit")} ${p.name}`}
                      onClick={() => openEdit(p)}
                    >
                      <Pencil size={14} />
                    </IconAction>
                    <IconAction
                      tone={p.active ? "danger" : "muted"}
                      disabled={busy}
                      aria-label={
                        p.active
                          ? tt(`Deactivate ${p.name}`, `ปิดใช้งาน ${p.name}`)
                          : tt(`Reactivate ${p.name}`, `เปิดใช้งาน ${p.name}`)
                      }
                      onClick={() =>
                        p.active
                          ? setConfirm(p)
                          : run(() => setEmployeeActive({ employeeId: p.id, active: true }))
                      }
                    >
                      {p.active ? <PowerOff size={14} /> : <Power size={14} />}
                    </IconAction>
                  </div>
                </Td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <Td colSpan={12} className="py-10 text-center text-muted">
                  {t("admin.noMatch")}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 p-5">
        <p className="text-xs text-muted">
          {tt(
            `${visible.length} of ${counts.active} active employees · ${counts.withLogin} have a login`,
            `${visible.length} จาก ${counts.active} คนที่ทำงานอยู่ · มีบัญชีเข้าสู่ระบบ ${counts.withLogin} คน`,
          )}
        </p>
        <Note className="max-w-xl">
          {tt(
            "Columns follow the requirement pack's Data Set: Employee_ID, Level, Role, Business Unit, Department, Division, Report to and Remark. Level follows the career role, because that is what the expected-level matrix is keyed on.",
            "คอลัมน์เป็นไปตามชุดข้อมูลในเอกสารความต้องการ: รหัสพนักงาน ระดับ บทบาท หน่วยธุรกิจ ฝ่าย แผนก ผู้บังคับบัญชา และหมายเหตุ โดยระดับจะอ้างอิงตามบทบาทสายอาชีพ เพราะเป็นคีย์ของตารางระดับที่คาดหวัง",
          )}
        </Note>
      </div>

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={mode !== "closed"}
        onClose={() => setMode("closed")}
        title={
          mode === "edit"
            ? tt("Edit Employee", "แก้ไขข้อมูลพนักงาน")
            : tt("Add New Employee", "เพิ่มพนักงานใหม่")
        }
        subtitle={tt(
          "Fields marked * are required.",
          "ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก",
        )}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setMode("closed")}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {mode === "edit" ? t("action.saveChanges") : t("action.add")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("label.name")} *`}>
            <Input
              value={draft.name}
              placeholder={tt("Enter Employee Name", "กรอกชื่อพนักงาน")}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={t("label.nickname")}>
            <Input
              value={draft.nickname}
              placeholder={tt("Enter Nickname", "กรอกชื่อเล่น")}
              onChange={(e) => set("nickname", e.target.value)}
            />
          </Field>
          <Field label={`${t("label.employeeId")} *`}>
            <Input
              value={draft.employeeCode}
              placeholder={tt("Enter Employee ID", "กรอกรหัสพนักงาน")}
              onChange={(e) => set("employeeCode", e.target.value)}
            />
          </Field>
          <Field
            label={`${t("label.email")} *`}
            hint={tt(
              "A Google sign-in is matched to this address.",
              "ระบบจะจับคู่บัญชี Google กับอีเมลนี้",
            )}
          >
            <Input
              type="email"
              value={draft.email}
              placeholder={tt("Enter Employee Email", "กรอกอีเมลพนักงาน")}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field
            label={`${t("label.role")} *`}
            hint={tt(
              `Level: ${levelOfDraftRole} — drives the expected-level matrix.`,
              `ระดับ: ${levelOfDraftRole} — ใช้กำหนดระดับที่คาดหวังในตารางสมรรถนะ`,
            )}
          >
            <Select
              value={draft.jobRoleId}
              onChange={(e) => set("jobRoleId", e.target.value)}
            >
              {jobRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.grade")}>
            <Input
              value={draft.grade}
              placeholder="EX1"
              onChange={(e) => set("grade", e.target.value)}
            />
          </Field>
          <Field label={t("label.position")}>
            <Select
              value={draft.positionId}
              onChange={(e) => set("positionId", e.target.value)}
            >
              <option value="">{tt("None", "ไม่ระบุ")}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.businessUnit")}>
            <Input
              value={draft.businessUnit}
              placeholder={tt("Enter business unit", "กรอกหน่วยธุรกิจ")}
              onChange={(e) => set("businessUnit", e.target.value)}
            />
          </Field>
          <Field label={t("label.department")}>
            <Select
              value={draft.departmentId}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  departmentId: e.target.value,
                  // a division belongs to a department, so changing one drops the other
                  divisionId: "",
                }))
              }
            >
              <option value="">{tt("None", "ไม่ระบุ")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.division")}>
            <Select
              value={draft.divisionId}
              onChange={(e) => set("divisionId", e.target.value)}
            >
              <option value="">{tt("None", "ไม่ระบุ")}</option>
              {draftDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.reportTo")}>
            <Select
              value={draft.managerId}
              onChange={(e) => set("managerId", e.target.value)}
            >
              <option value="">{tt("Nobody", "ไม่มี")}</option>
              {employees
                .filter((p) => p.active && p.id !== editing?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.jobRoleName}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t("label.remark")} className="sm:col-span-2">
            <Textarea
              value={draft.remark}
              placeholder={tt(
                "Anything HR should know (secondment, probation, ...)",
                "ข้อมูลเพิ่มเติมสำหรับฝ่ายบุคคล (การยืมตัว ทดลองงาน ฯลฯ)",
              )}
              onChange={(e) => set("remark", e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* --------------------------------------------------- deactivate */}
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Deactivate employee", "ปิดใช้งานพนักงาน")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (target)
                  run(() => setEmployeeActive({ employeeId: target.id, active: false }));
              }}
            >
              {tt("Deactivate", "ปิดใช้งาน")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tt("Deactivate", "ปิดใช้งาน")}{" "}
          <span className="font-medium text-ink">{confirm?.name}</span>?{" "}
          {tt(
            "They drop out of the roster, the leaderboard and the cycle counts. Nothing is deleted — their scores, certificates and points ledger all stay, and reactivating brings them straight back.",
            "พนักงานจะหายจากรายชื่อ ตารางอันดับ และการนับในรอบประเมิน แต่ไม่มีข้อมูลใดถูกลบ คะแนน ใบรับรอง และบัญชีคะแนนยังอยู่ครบ และเปิดใช้งานใหม่ได้ทันที",
          )}
        </p>
      </Modal>
    </div>
  );
}
