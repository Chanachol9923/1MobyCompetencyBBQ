"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, KeyRound, Pencil, Power, PowerOff, Plus } from "lucide-react";
import { Avatar, Button, Field, Input, Modal, Pill, Select, Textarea } from "@/components/ui";
import {
  IconAction,
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
import { cn } from "@/lib/utils";

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
  const { t, tt, lv } = useT();
  const { employees, departments, divisions, positions, jobRoles, counts } = data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<"closed" | "add" | "edit">("closed");
  const [editing, setEditing] = useState<AdminEmployeeRow | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(jobRoles[0]?.id ?? ""));
  const [confirm, setConfirm] = useState<AdminEmployeeRow | null>(null);
  const [busy, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

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
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const sortedDepartments = useMemo(() => [...departments].sort(byName), [departments]);
  const positionsById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  /** Positions belong to a department; only that department's are offered. */
  const draftPositions = useMemo(
    () => positions.filter((p) => p.parentId === draft.departmentId).sort(byName),
    [positions, draft.departmentId],
  );

  /** Reports-to, grouped by department so two people with one title stay distinct. */
  const managerGroups = useMemo(() => {
    const groups = new Map<string, typeof employees>();
    for (const p of employees) {
      if (!p.active || p.id === editing?.id) continue;
      const key = p.departmentName ?? tt("No department", "ไม่มีฝ่าย");
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dept, people]) => [dept, people.sort(byName)] as const);
    // tt only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, editing]);

  const draftDivisions = useMemo(
    () => divisions.filter((d) => d.parentId === draft.departmentId).sort(byName),
    [divisions, draft.departmentId],
  );

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => onResult(await fn()));
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setFormError(null);
    setDraft(emptyDraft(jobRoles[0]?.id ?? ""));
    setEditing(null);
    setMode("add");
  }

  function openEdit(p: AdminEmployeeRow) {
    setFormError(null);
    setDraft(fromRow(p));
    setEditing(p);
    setMode("edit");
  }

  // the dialog stays open until the save succeeds, so a refusal never costs
  // the administrator what they typed
  function save() {
    const payload = { ...draft };
    const target = editing;
    setFormError(null);
    startTransition(async () => {
      const res = target
        ? await updateEmployee({ ...payload, employeeId: target.id })
        : await createEmployee(payload);
      if (res.ok) {
        setMode("closed");
        onResult(res);
      } else {
        setFormError(tt(res.error.en, res.error.th));
      }
    });
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
            {tt("Add employee", "เพิ่มพนักงาน")}
          </Button>
        </div>
      </div>

      <TableWrap>
        {/* six columns that fit a laptop screen; grade, business unit and
            remarks live in each person's details and in the CSV export */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th>{t("label.employee")}</Th>
              <Th>{t("label.position")}</Th>
              <Th>{t("label.department")}</Th>
              <Th>{t("label.reportTo")}</Th>
              <Th>{t("label.status")}</Th>
              <Th className="w-24 text-right">{t("label.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-line/60 transition-colors last:border-0 hover:bg-surface/40",
                  !p.active && "opacity-60",
                )}
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size={32} />
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{p.name}</span>
                      <span className="block text-[11px] text-muted">
                        <span className="font-mono">{p.employeeCode}</span>
                        {p.nickname ? ` · ${p.nickname}` : ""}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td>
                  <span className="block font-medium text-ink">
                    {p.positionName ?? p.jobRoleName}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {p.jobRoleName} · {lv(p.level)}
                  </span>
                </Td>
                <Td>
                  <span className="block font-medium text-ink">{p.departmentName ?? "—"}</span>
                  {p.divisionName ? (
                    <span className="block text-[11px] text-muted">{p.divisionName}</span>
                  ) : null}
                </Td>
                <Td>
                  <span className="block text-ink">{p.managerName ?? "—"}</span>
                  {p.reportCount ? (
                    <span className="block text-[11px] text-brand">
                      {tt(
                        `Manages ${p.reportCount}`,
                        `ดูแล ${p.reportCount} คน`,
                      )}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.active ? (
                      <Pill tone="success">{tt("Active", "ทำงานอยู่")}</Pill>
                    ) : (
                      <Pill tone="neutral">{tt("Deactivated", "ปิดใช้งาน")}</Pill>
                    )}
                    {p.hasLogin ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-muted"
                        title={tt("Has a login account", "มีบัญชีเข้าสู่ระบบ")}
                      >
                        <KeyRound size={11} className="text-brand" />
                        {tt("Login", "มีบัญชี")}
                      </span>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <IconAction
                      tone="brand"
                      title={t("action.edit")}
                      aria-label={`${t("action.edit")} ${p.name}`}
                      onClick={() => openEdit(p)}
                    >
                      <Pencil size={14} />
                    </IconAction>
                    <IconAction
                      tone={p.active ? "danger" : "muted"}
                      disabled={busy}
                      title={
                        p.active
                          ? tt("Deactivate", "ปิดใช้งาน")
                          : tt("Reactivate", "เปิดใช้งานอีกครั้ง")
                      }
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
                <Td colSpan={6} className="py-10 text-center text-muted">
                  {t("admin.noMatch")}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>

      <div className="border-t border-line/70 px-5 py-4">
        <p className="text-xs text-muted">
          {tt(
            `Showing ${visible.length} of ${counts.active} active employees · ${counts.withLogin} have a login account. Grade, business unit and remarks are in each person's details and the CSV export.`,
            `แสดง ${visible.length} จาก ${counts.active} คนที่ทำงานอยู่ · มีบัญชีเข้าสู่ระบบ ${counts.withLogin} คน ระดับเกรด หน่วยธุรกิจ และหมายเหตุ ดูได้ในรายละเอียดของแต่ละคนและไฟล์ CSV`,
          )}
        </p>
      </div>

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={mode !== "closed"}
        onClose={() => setMode("closed")}
        title={
          mode === "edit"
            ? tt("Edit employee", "แก้ไขข้อมูลพนักงาน")
            : tt("Add employee", "เพิ่มพนักงาน")
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
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink"
          >
            {formError}
          </p>
        ) : null}
        <FormSection title={tt("Personal details", "ข้อมูลส่วนตัว")}>
          <Field label={`${t("label.name")} *`}>
            <Input
              value={draft.name}
              placeholder={tt("First and last name", "ชื่อและนามสกุล")}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={t("label.nickname")}>
            <Input
              value={draft.nickname}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("nickname", e.target.value)}
            />
          </Field>
          <Field
            label={`${t("label.employeeId")} *`}
            hint={tt("3–4 letters or digits", "ตัวอักษรหรือตัวเลข 3–4 ตัว")}
          >
            <Input
              maxLength={4}
              value={draft.employeeCode}
              placeholder={tt("e.g. 1ASD", "เช่น 1ASD")}
              onChange={(e) => set("employeeCode", e.target.value.toUpperCase())}
            />
          </Field>
          <Field
            label={`${t("label.email")} *`}
            hint={
              editing?.hasLogin
                ? tt(
                    "This is their login ID — change it under Accounts.",
                    "อีเมลนี้คือไอดีเข้าสู่ระบบ เปลี่ยนได้ที่หน้าบัญชีผู้ใช้",
                  )
                : tt(
                    "Becomes their login ID when an account is created.",
                    "จะใช้เป็นไอดีเข้าสู่ระบบเมื่อสร้างบัญชี",
                  )
            }
          >
            <Input
              type="email"
              disabled={Boolean(editing?.hasLogin)}
              value={draft.email}
              placeholder="name.sur@1moby.com"
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </FormSection>

        <FormSection title={tt("Job", "งาน")} className="mt-6">
          <Field label={t("label.department")}>
            <Select
              value={draft.departmentId}
              onChange={(e) => {
                const departmentId = e.target.value;
                setDraft((d) => ({
                  ...d,
                  departmentId,
                  // a division belongs to one department, and so does a position
                  divisionId: "",
                  positionId: positionsById.get(d.positionId)?.parentId === departmentId
                    ? d.positionId
                    : "",
                }));
              }}
            >
              <option value="">{tt("Select a department", "เลือกฝ่าย")}</option>
              {sortedDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("label.division")}
            hint={draft.departmentId ? undefined : tt("Pick a department first", "เลือกฝ่ายก่อน")}
          >
            <Select
              value={draft.divisionId}
              disabled={!draft.departmentId}
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
          <Field
            label={t("label.position")}
            hint={draft.departmentId ? undefined : tt("Pick a department first", "เลือกฝ่ายก่อน")}
          >
            <Select
              value={draft.positionId}
              disabled={!draft.departmentId}
              onChange={(e) => set("positionId", e.target.value)}
            >
              <option value="">{tt("None", "ไม่ระบุ")}</option>
              {draftPositions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={`${tt("Career role", "บทบาทสายอาชีพ")} *`}
            hint={tt(
              `${levelOfDraftRole} — decides which competencies are assessed and at what level.`,
              `${levelOfDraftRole} — เป็นตัวกำหนดสมรรถนะที่ประเมินและระดับที่คาดหวัง`,
            )}
          >
            <Select value={draft.jobRoleId} onChange={(e) => set("jobRoleId", e.target.value)}>
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
              placeholder={tt("e.g. EX1", "เช่น EX1")}
              onChange={(e) => set("grade", e.target.value)}
            />
          </Field>
          <Field label={t("label.businessUnit")}>
            <Input
              value={draft.businessUnit}
              placeholder={tt("e.g. Software Production", "เช่น Software Production")}
              onChange={(e) => set("businessUnit", e.target.value)}
            />
          </Field>
          <Field label={t("label.reportTo")} className="sm:col-span-2">
            <Select value={draft.managerId} onChange={(e) => set("managerId", e.target.value)}>
              <option value="">{tt("Nobody", "ไม่มี")}</option>
              {managerGroups.map(([dept, people]) => (
                <optgroup key={dept} label={dept}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.positionName ?? p.jobRoleName}
                    </option>
                  ))}
                </optgroup>
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
        </FormSection>
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
            "They drop out of the roster, the leaderboard and the cycle counts. Nothing is deleted — their scores, certificates and points all stay, and their login is suspended. Reactivating brings the record straight back.",
            "พนักงานจะหายจากรายชื่อ ตารางอันดับ และการนับในรอบประเมิน แต่ไม่มีข้อมูลใดถูกลบ คะแนน ใบรับรอง และแต้มสะสมยังอยู่ครบ และบัญชีเข้าสู่ระบบจะถูกระงับ เปิดใช้งานข้อมูลใหม่ได้ทันที",
          )}
        </p>
      </Modal>
    </div>
  );
}

/** A titled group of fields in a form, two columns from the small breakpoint. */
function FormSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
