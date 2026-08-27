"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  IconAction,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
} from "@/components/admin/shared";
import { COMPETENCIES } from "@/data/competencies";
import {
  DEPARTMENTS,
  DIVISIONS,
  JOB_ROLES,
  POSITIONS,
  findPerson,
  type Person,
} from "@/data/people";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";

const LEVELS = [
  "Level 1: Operation",
  "Level 2: Senior Operation",
  "Level 3: Supervise",
  "Level 4: Management",
  "Level 5: Strategy",
];

const BUSINESS_UNITS = Array.from(new Set(DEPARTMENTS.map((d) => d.name)));

type Draft = {
  employeeId: string;
  name: string;
  nickname: string;
  email: string;
  level: string;
  grade: string;
  position: string;
  jobRole: string;
  businessUnit: string;
  department: string;
  division: string;
  /** a person id, or "-" for nobody */
  reportTo: string;
  remark: string;
};

const emptyDraft = (): Draft => ({
  employeeId: "",
  name: "",
  nickname: "",
  email: "",
  level: LEVELS[0]!,
  grade: "EX1",
  position: POSITIONS[0]!.name,
  jobRole: JOB_ROLES[0]!.name,
  businessUnit: BUSINESS_UNITS[0]!,
  department: DEPARTMENTS[0]!.name,
  division: DIVISIONS[0]!.name,
  reportTo: "-",
  remark: "",
});

const fromPerson = (p: Person): Draft => ({
  employeeId: p.employeeId,
  name: p.name,
  nickname: p.nickname,
  email: p.email,
  level: p.level,
  grade: p.grade,
  position: p.position,
  jobRole: p.jobRole,
  businessUnit: p.businessUnit,
  department: p.department,
  division: p.division,
  reportTo: p.reportTo || "-",
  remark: p.remark,
});

function baseScores() {
  const scores: Record<string, number> = {};
  COMPETENCIES.forEach((c) => (scores[c.id] = 3));
  return scores;
}

export function EmployeesTab() {
  const { state, update, notify, logActivity } = useDemo();
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [mode, setMode] = useState<"closed" | "add" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Person | null>(null);

  const employees = state.employees;

  /** `reportTo` holds a person id — resolve it to a readable name. */
  const managerName = (id: string) => {
    if (!id || id === "-") return "—";
    const local = employees.find((p) => p.id === id);
    if (local) return local.name;
    const seeded = findPerson(id);
    return seeded.id === id ? seeded.name : id;
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((p) => {
      const matchQ =
        !q ||
        [
          p.name,
          p.nickname,
          p.employeeId,
          p.position,
          p.jobRole,
          p.level,
          p.businessUnit,
          p.department,
          p.division,
        ].some((v) => (v ?? "").toLowerCase().includes(q));
      const matchF = filter === "all" || p.department === filter;
      return matchQ && matchF;
    });
  }, [employees, query, filter]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setMode("add");
  }

  function openEdit(p: Person) {
    setDraft(fromPerson(p));
    setEditingId(p.id);
    setMode("edit");
  }

  function save() {
    if (!draft.name.trim()) {
      notify(tt("Employee name is required", "กรุณากรอกชื่อพนักงาน"));
      return;
    }
    const patch = {
      employeeId: draft.employeeId.trim(),
      name: draft.name.trim(),
      nickname: draft.nickname.trim() || draft.name.trim().split(" ")[0]!,
      email: draft.email.trim(),
      level: draft.level,
      grade: draft.grade.trim(),
      position: draft.position,
      title: draft.position,
      jobRole: draft.jobRole,
      businessUnit: draft.businessUnit,
      department: draft.department,
      division: draft.division,
      reportTo: draft.reportTo,
      remark: draft.remark.trim(),
    };

    if (mode === "edit" && editingId) {
      update((s) => ({
        ...s,
        employees: s.employees.map((p) =>
          p.id === editingId
            ? {
                ...p,
                ...patch,
                employeeId: patch.employeeId || p.employeeId,
                email: patch.email || p.email,
              }
            : p,
        ),
      }));
      logActivity("Updated employee", patch.name, `${patch.jobRole} · ${patch.level}`);
      notify(tt(`${patch.name} updated`, `อัปเดตข้อมูล ${patch.name} แล้ว`));
    } else {
      const id = `${patch.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()
        .toString()
        .slice(-4)}`;
      const person: Person = {
        id,
        ...patch,
        employeeId:
          patch.employeeId || String(1000 + Math.floor(Math.random() * 8999)),
        email: patch.email || `${id}@1moby.demo`,
        grade: patch.grade || "EX1",
        scores: baseScores(),
        selfScores: {},
        managerScores: baseScores(),
        skillIndex: 3,
        phase: 0,
        points: 0,
        activity: "Just added",
      };
      update((s) => ({
        ...s,
        employees: [...s.employees, person],
        points: { ...s.points, [id]: 0 },
        idp: { ...s.idp, [id]: [] },
      }));
      logActivity("Added employee", person.name, `${person.jobRole} · ${person.level}`);
      notify(
        tt(
          `${person.name} added to the organisation`,
          `เพิ่ม ${person.name} เข้าองค์กรแล้ว`,
        ),
      );
    }
    setMode("closed");
  }

  function remove(p: Person) {
    update((s) => ({ ...s, employees: s.employees.filter((e) => e.id !== p.id) }));
    logActivity("Removed employee", p.name, p.employeeId);
    notify(tt(`${p.name} removed`, `ลบ ${p.name} แล้ว`));
    setConfirm(null);
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
        p.employeeId,
        p.name,
        p.nickname,
        p.email,
        p.level,
        p.jobRole,
        p.position,
        p.grade,
        p.businessUnit,
        p.department,
        p.division,
        managerName(p.reportTo),
        p.remark,
      ]),
    );
    logActivity("Exported employee list", `${visible.length} rows`);
    notify(
      tt(
        `Employee list exported as CSV (${visible.length} rows)`,
        `ส่งออกรายชื่อพนักงานเป็น CSV แล้ว (${visible.length} แถว)`,
      ),
    );
  }

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
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            <Download size={14} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
          <Button size="sm" onClick={openAdd}>
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
                      <span className="block font-bold">{p.name}</span>
                      <span className="block text-[10px] text-muted">
                        {p.nickname}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td className="font-bold">{p.employeeId}</Td>
                <Td className="whitespace-nowrap text-muted">{p.level}</Td>
                <Td className="font-bold">{p.jobRole}</Td>
                <Td className="text-muted">{p.position}</Td>
                <Td className="text-muted">{p.grade}</Td>
                <Td className="text-muted">{p.businessUnit}</Td>
                <Td className="font-bold">{p.department}</Td>
                <Td className="max-w-[220px] text-muted">{p.division}</Td>
                <Td className="whitespace-nowrap text-muted">
                  {managerName(p.reportTo)}
                </Td>
                <Td className="max-w-[180px] text-muted">{p.remark || "—"}</Td>
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
                      tone="danger"
                      aria-label={`${t("action.delete")} ${p.name}`}
                      onClick={() => setConfirm(p)}
                    >
                      <Trash2 size={14} />
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
            `${visible.length} of ${employees.length} employees`,
            `${visible.length} จาก ${employees.length} คน`,
          )}
        </p>
        <Note className="max-w-xl">
          {tt(
            "Columns follow the requirement pack's Data Set: Employee_ID, Level, Role, Business Unit, Department, Division, Report to and Remark. Scroll sideways to see them all.",
            "คอลัมน์เป็นไปตามชุดข้อมูลในเอกสารความต้องการ: รหัสพนักงาน ระดับ บทบาท หน่วยธุรกิจ ฝ่าย แผนก ผู้บังคับบัญชา และหมายเหตุ เลื่อนตารางไปด้านข้างเพื่อดูทั้งหมด",
          )}
        </Note>
      </div>

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
            <Button onClick={save}>
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
          <Field
            label={t("label.employeeId")}
            hint={tt("Leave blank to generate", "เว้นว่างเพื่อสร้างอัตโนมัติ")}
          >
            <Input
              value={draft.employeeId}
              placeholder={tt("Enter Employee ID", "กรอกรหัสพนักงาน")}
              onChange={(e) => set("employeeId", e.target.value)}
            />
          </Field>
          <Field label={t("label.email")}>
            <Input
              type="email"
              value={draft.email}
              placeholder={tt("Enter Employee Email", "กรอกอีเมลพนักงาน")}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label={t("label.level")}>
            <Select value={draft.level} onChange={(e) => set("level", e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("label.role")}
            hint={tt(
              "Drives the expected-level matrix.",
              "ใช้กำหนดระดับที่คาดหวังในตารางสมรรถนะ",
            )}
          >
            <Select value={draft.jobRole} onChange={(e) => set("jobRole", e.target.value)}>
              {JOB_ROLES.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.position")}>
            <Select value={draft.position} onChange={(e) => set("position", e.target.value)}>
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
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
          <Field label={t("label.businessUnit")}>
            <Select
              value={draft.businessUnit}
              onChange={(e) => set("businessUnit", e.target.value)}
            >
              {BUSINESS_UNITS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.department")}>
            <Select
              value={draft.department}
              onChange={(e) => set("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.division")}>
            <Select value={draft.division} onChange={(e) => set("division", e.target.value)}>
              {DIVISIONS.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.reportTo")}>
            <Select value={draft.reportTo} onChange={(e) => set("reportTo", e.target.value)}>
              <option value="-">{tt("Nobody", "ไม่มี")}</option>
              <option value="neo">Neo · HROD</option>
              {employees
                .filter((p) => p.id !== editingId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.jobRole}
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

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete employee", "ลบพนักงาน")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={() => confirm && remove(confirm)}>
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt("Remove", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.name}</span>{" "}
          {tt("from the employee list?", "ออกจากรายชื่อพนักงานหรือไม่?")}{" "}
          {t("admin.onlyDemoData")}
        </p>
      </Modal>
    </div>
  );
}
