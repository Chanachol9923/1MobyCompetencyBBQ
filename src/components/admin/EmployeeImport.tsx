"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Loader2, Upload } from "lucide-react";
import { Button, Input, Modal, Pill } from "@/components/ui";
import type { AdminEmployeeRow, EmployeeAdminData } from "@/components/admin/content-types";
import type { ImportPlan, ImportRowPlan } from "@/components/admin/import-types";
import { applyEmployeeImport, fetchGoogleSheet, previewEmployeeImport } from "@/server/employee-import";
import { parseCsv } from "@/lib/csv-parse";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

/**
 * The columns of the staff data set, named and ordered as in the requirement
 * brief (§4 Data Set & Field): Employee_ID, Level, Role, Business Unit,
 * Department, Division, Report to, Remark — with Name and Email, which a new
 * person needs, and Grade/Nickname. Level is the career level (Senior,
 * Specialist…), Role is the job title (HROD…), Report to is the manager's
 * Employee_ID. The export, the template and the import all use these, so a
 * downloaded list can be edited and brought straight back in.
 */
export const SHEET_COLUMNS = [
  "Employee_ID",
  "Name",
  "Email",
  "Level",
  "Role",
  "Business Unit",
  "Department",
  "Division",
  "Report to",
  "Remark",
  "Grade",
  "Nickname",
] as const;

const COLUMN_WIDTHS = [12, 26, 30, 16, 32, 28, 28, 28, 12, 24, 8, 12];

/** The staff list as a real .xlsx, in the brief's columns. */
export async function exportEmployeesXlsx(rows: AdminEmployeeRow[], all: AdminEmployeeRow[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const codeOf = new Map(all.map((e) => [e.id, e.employeeCode]));
  const header = SHEET_COLUMNS.map((c) => ({ value: c, fontWeight: "bold" as const }));
  const body = rows.map((p) =>
    [
      p.employeeCode,
      p.name,
      p.email,
      p.jobRoleName,
      p.positionName ?? "",
      p.businessUnit ?? "",
      p.departmentName ?? "",
      p.divisionName ?? "",
      p.managerId ? (codeOf.get(p.managerId) ?? "") : "",
      p.remark ?? "",
      p.grade ?? "",
      p.nickname ?? "",
    ].map((value) => ({ value, type: String })),
  );
  await writeXlsxFile([header, ...body], {
    sheet: "Employees",
    columns: COLUMN_WIDTHS.map((width) => ({ width })),
    stickyRowsCount: 1,
  }).toFile("1moby-employees.xlsx");
}

/** An empty sheet in the brief's columns, with a second sheet saying how to fill it. */
export async function downloadTemplate(data: EmployeeAdminData) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const levels = data.jobRoles.map((r) => `${r.name} (${r.level}${r.gradeFrom ? `, ${r.gradeFrom}–${r.gradeTo}` : ""})`).join("\n");
  const help: [string, string, string][] = [
    ["Employee_ID", "จำเป็น", "รหัสพนักงาน ตัวเลข 3–4 หลักเท่านั้น ใช้จับคู่กับคนที่มีอยู่แล้ว"],
    ["Name", "จำเป็นสำหรับคนใหม่", "ชื่อ-นามสกุล (หรือใช้คอลัมน์ First name / Last name แยกกัน)"],
    ["Email", "จำเป็นสำหรับคนใหม่", "อีเมลบริษัท ใช้เป็นไอดีเข้าสู่ระบบ (SSO)"],
    ["Level", "จำเป็นสำหรับคนใหม่", `ระดับในสายอาชีพ ใช้ได้:\n${levels}\nถ้าเว้นว่างแต่มี Grade ระบบจะเลือกให้ตาม Grade`],
    ["Role", "", "ตำแหน่งงาน เช่น HROD, Project Management Office Specialist (ถ้ายังไม่มีในระบบจะสร้างให้)"],
    ["Business Unit", "", "หน่วยธุรกิจ"],
    ["Department", "", "ฝ่าย (ถ้ายังไม่มีในระบบจะสร้างให้)"],
    ["Division", "", "ส่วนงานภายใต้ Department (ต้องมี Department คู่กัน)"],
    ["Report to", "", "หัวหน้า: Employee_ID (แนะนำ) อีเมล ชื่อ หรือชื่อตำแหน่งที่มีคนเดียว เช่น Chief Executive Officer"],
    ["Remark", "", "หมายเหตุ"],
    ["Grade", "", "เช่น EX1, SR2, SP3, TL1, MG2, EP1"],
    ["Nickname", "", "ชื่อเล่น"],
  ];
  const bold = (value: string) => ({ value, fontWeight: "bold" as const });
  await writeXlsxFile([
    {
      sheet: "Employees",
      data: [SHEET_COLUMNS.map(bold)],
      columns: COLUMN_WIDTHS.map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      sheet: "How to fill",
      data: [
        [bold("Column"), bold("Required"), bold("How to fill it")],
        ...help.map((r) => r.map((value) => ({ value, wrap: true }))),
        [null, null, null],
        [
          null,
          null,
          {
            value:
              "แถวที่ Employee_ID ตรงกับคนที่มีอยู่จะอัปเดตเฉพาะช่องที่กรอก ช่องว่างไม่ลบข้อมูลเดิม · ระบบแสดงตัวอย่างก่อนบันทึกทุกครั้ง",
            wrap: true,
          },
        ],
      ],
      columns: [{ width: 16 }, { width: 22 }, { width: 80 }],
    },
  ]).toFile("1moby-employee-template.xlsx");
}

/** Cells of the first sheet of an .xlsx, or of a .csv, as text. */
async function readFile(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(await file.text());
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return rows.map((r) =>
    r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))),
  );
}

const ACTION_TONE: Record<ImportRowPlan["action"], "success" | "brand" | "neutral" | "danger"> = {
  create: "success",
  update: "brand",
  same: "neutral",
  error: "danger",
};

export function EmployeeImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tt } = useT();
  const { notify } = useUi();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [cells, setCells] = useState<string[][] | null>(null);
  const [source, setSource] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [busy, start] = useTransition();

  const reset = () => {
    setCells(null);
    setPlan(null);
    setError(null);
    setSource("");
  };
  const close = () => {
    reset();
    setUrl("");
    onClose();
  };

  const preview = (next: string[][], from: string) =>
    start(async () => {
      setError(null);
      const res = await previewEmployeeImport({ cells: next });
      if (!res.ok) {
        setError(tt(res.error.en, res.error.th));
        return;
      }
      setCells(next);
      setSource(from);
      setPlan(res.plan);
    });

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      try {
        preview(await readFile(file), file.name);
      } catch {
        setError(tt("That file could not be read. Use .xlsx or .csv.", "อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .xlsx หรือ .csv"));
      }
    });
  };

  const fromSheet = () =>
    start(async () => {
      setError(null);
      const res = await fetchGoogleSheet({ url });
      if (!res.ok) setError(tt(res.error.en, res.error.th));
      else preview(res.cells, "Google Sheets");
    });

  const apply = () =>
    start(async () => {
      if (!cells) return;
      const res = await applyEmployeeImport({ cells, source });
      if (!res.ok) {
        setError(tt(res.error.en, res.error.th));
        return;
      }
      notify(
        tt(
          `Imported: ${res.created} added, ${res.updated} updated${res.plan.counts.error ? `, ${res.plan.counts.error} skipped` : ""}.`,
          `นำเข้าแล้ว: เพิ่ม ${res.created} คน อัปเดต ${res.updated} คน${res.plan.counts.error ? ` ข้าม ${res.plan.counts.error} แถว` : ""}`,
        ),
      );
      router.refresh();
      close();
    });

  const toApply = plan ? plan.counts.create + plan.counts.update : 0;
  const shown = plan ? plan.rows.filter((r) => !onlyIssues || r.problems.length || r.warnings.length) : [];

  return (
    <Modal
      open={open}
      onClose={close}
      title={tt("Import employees", "นำเข้ารายชื่อพนักงาน")}
      subtitle={tt(
        "From an Excel file or a Google Sheet, in the data-set columns: Employee_ID, Name, Email, Level, Role, Business Unit, Department, Division, Report to, Remark.",
        "จากไฟล์ Excel หรือ Google Sheet ตามคอลัมน์ชุดข้อมูล: Employee_ID, Name, Email, Level, Role, Business Unit, Department, Division, Report to, Remark",
      )}
      width="max-w-4xl"
      footer={
        plan ? (
          <>
            <Button variant="outline" onClick={reset} disabled={busy}>
              {tt("Choose another", "เลือกไฟล์อื่น")}
            </Button>
            <Button onClick={apply} disabled={busy || toApply === 0}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {tt(`Import ${toApply} row(s)`, `นำเข้า ${toApply} รายการ`)}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={close}>
            {tt("Cancel", "ยกเลิก")}
          </Button>
        )
      }
    >
      {!plan ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <FileSpreadsheet size={16} className="text-success" /> {tt("Excel or CSV file", "ไฟล์ Excel หรือ CSV")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {tt("The first sheet is read; the header row must name Employee_ID.", "ระบบอ่านชีตแรก และแถวหัวตารางต้องมี Employee_ID")}
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button className="mt-3" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload size={15} /> {tt("Choose file", "เลือกไฟล์")}
            </Button>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Link2 size={16} className="text-brand" /> Google Sheet
            </p>
            <p className="mt-1 text-xs text-muted">
              {tt(
                'Share the sheet as "Anyone with the link can view", then paste its link. The tab in the link is the one read.',
                'แชร์ชีตเป็น "ทุกคนที่มีลิงก์ดูได้" แล้ววางลิงก์ ระบบอ่านแท็บที่อยู่ในลิงก์',
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                aria-label="Google Sheet link"
              />
              <Button onClick={fromSheet} disabled={busy || !url.trim()}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : tt("Read", "ดึงข้อมูล")}
              </Button>
            </div>
          </div>
          {error ? (
            <p className="flex items-start gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent md:col-span-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">{source}</span>
            <Pill tone="success">{tt(`${plan.counts.create} new`, `เพิ่ม ${plan.counts.create}`)}</Pill>
            <Pill tone="brand">{tt(`${plan.counts.update} updated`, `อัปเดต ${plan.counts.update}`)}</Pill>
            <Pill tone="neutral">{tt(`${plan.counts.same} unchanged`, `ไม่เปลี่ยน ${plan.counts.same}`)}</Pill>
            {plan.counts.error ? (
              <Pill tone="danger">{tt(`${plan.counts.error} with problems (skipped)`, `มีปัญหา ${plan.counts.error} (จะข้าม)`)}</Pill>
            ) : null}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="size-4 accent-[#006bff]" />
              {tt("Only rows to check", "เฉพาะแถวที่ต้องตรวจ")}
            </label>
          </div>
          {plan.create.departments.length || plan.create.divisions.length || plan.create.positions.length ? (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-ink">
              {tt("Will also be created: ", "จะสร้างเพิ่มด้วย: ")}
              {[
                plan.create.departments.length ? `${tt("Departments", "ฝ่าย")} ${plan.create.departments.join(", ")}` : "",
                plan.create.divisions.length ? `${tt("Divisions", "ส่วนงาน")} ${plan.create.divisions.join(", ")}` : "",
                plan.create.positions.length ? `${tt("Roles", "ตำแหน่ง")} ${plan.create.positions.join(", ")}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{tt("Line", "แถว")}</th>
                  <th className="px-3 py-2 font-medium">Employee_ID</th>
                  <th className="px-3 py-2 font-medium">{tt("Name", "ชื่อ")}</th>
                  <th className="px-3 py-2 font-medium">{tt("Result", "ผล")}</th>
                  <th className="px-3 py-2 font-medium">{tt("Details", "รายละเอียด")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line} className="border-t border-line/70 align-top">
                    <td className="px-3 py-2 text-muted">{r.line}</td>
                    <td className="px-3 py-2 font-mono">{r.code || "—"}</td>
                    <td className="px-3 py-2 text-ink">{r.name || "—"}</td>
                    <td className="px-3 py-2">
                      <Pill tone={ACTION_TONE[r.action]}>
                        {r.action === "create"
                          ? tt("New", "เพิ่มใหม่")
                          : r.action === "update"
                            ? tt("Update", "อัปเดต")
                            : r.action === "same"
                              ? tt("No change", "ไม่เปลี่ยน")
                              : tt("Problem", "มีปัญหา")}
                      </Pill>
                    </td>
                    <td className="space-y-0.5 px-3 py-2 leading-snug">
                      {r.problems.map((m) => (
                        <p key={m.en} className="text-accent">{tt(m.en, m.th)}</p>
                      ))}
                      {r.warnings.map((m) => (
                        <p key={m.en} className="text-amber">{tt(m.en, m.th)}</p>
                      ))}
                      {r.changes.map((m) => (
                        <p key={m.en} className={cn("text-muted", r.action === "error" && "line-through opacity-60")}>
                          {tt(m.en, m.th)}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
