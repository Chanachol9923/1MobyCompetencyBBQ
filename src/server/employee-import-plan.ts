import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ImportMessage, ImportPlan, ImportRowPlan } from "@/components/admin/import-types";

/**
 * Working out what an employee import would do — the part of
 * `employee-import.ts` that reads the sheet and the database but never writes,
 * so the preview and the apply share it and it can be tested on its own.
 */

export const MAX_ROWS = 2000;

/* ------------------------------------------------------------- columns */

type Field =
  | "code"
  | "level"
  | "role"
  | "businessUnit"
  | "department"
  | "division"
  | "reportTo"
  | "remark"
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "nickname"
  | "grade";

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.()/:]+/g, "");

const HEADERS: Record<Field, string[]> = {
  code: ["employeeid", "empid", "employeecode", "staffid", "id", "รหัสพนักงาน", "รหัส"],
  level: ["level", "careerlevel", "jobrole", "careerrole", "ระดับ", "ระดับตำแหน่ง"],
  role: ["role", "position", "jobtitle", "title", "ตำแหน่ง", "ตำแหน่งงาน"],
  businessUnit: ["businessunit", "bu", "หน่วยธุรกิจ"],
  department: ["department", "dept", "ฝ่าย", "แผนก"],
  division: ["division", "ส่วนงาน", "หน่วยงาน"],
  reportTo: ["reportto", "reportsto", "manager", "supervisor", "หัวหน้า", "ผู้บังคับบัญชา", "รายงานต่อ"],
  remark: ["remark", "remarks", "note", "notes", "หมายเหตุ"],
  name: ["name", "fullname", "employeename", "ชื่อ", "ชื่อนามสกุล", "ชื่อสกุล"],
  firstName: ["firstname", "givenname", "ชื่อจริง"],
  lastName: ["lastname", "surname", "familyname", "นามสกุล"],
  email: ["email", "workemail", "emailaddress", "อีเมล", "อีเมลล์"],
  nickname: ["nickname", "ชื่อเล่น"],
  grade: ["grade", "เกรด"],
};

const FIELD_OF = new Map<string, Field>();
for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
  for (const n of names) FIELD_OF.set(norm(n), field);
}

type SheetRow = Partial<Record<Field, string>> & { line: number };

/** Find the header row (the first one naming Employee_ID) and read the rest under it. */
function readSheet(cells: string[][]): { rows: SheetRow[]; columns: string[] } | null {
  for (let h = 0; h < Math.min(cells.length, 10); h++) {
    const fields = cells[h]!.map((c) => FIELD_OF.get(norm(String(c ?? ""))) ?? null);
    if (!fields.includes("code")) continue;
    const rows: SheetRow[] = [];
    for (let r = h + 1; r < cells.length; r++) {
      const row: SheetRow = { line: r + 1 };
      fields.forEach((f, i) => {
        const v = String(cells[r]![i] ?? "").trim();
        if (f && v) row[f] = v;
      });
      if (Object.keys(row).length > 1) rows.push(row);
    }
    return { rows, columns: fields.filter((f): f is Field => Boolean(f)) };
  }
  return null;
}

/* ---------------------------------------------------------------- plan */

export const cellsSchema = z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(MAX_ROWS + 10);
export const toCells = (raw: z.infer<typeof cellsSchema>) => raw.map((r) => r.map((c) => (c === null ? "" : String(c))));

export const ci = (s: string) => s.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** every message in the preview, in both languages (brief §7) */
const msg = (en: string, th: string) => ({ en, th });

export type Planned = ImportRowPlan & {
  employeeId: string | null;
  data: {
    employeeCode: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    nickname?: string;
    grade?: string;
    businessUnit?: string;
    remark?: string;
    jobRoleId?: string;
    department?: string;
    division?: string;
    position?: string;
  };
  /** the code of the person they report to, once resolved */
  managerCode: string | null;
};

export async function buildPlan(cells: string[][]): Promise<{ plan: ImportPlan; planned: Planned[] } | null> {
  const sheet = readSheet(cells);
  if (!sheet) return null;

  const [jobRoles, employees, departments, divisions, positions] = await Promise.all([
    db.jobRole.findMany({ select: { id: true, key: true, name: true, level: true, gradeFrom: true, gradeTo: true } }),
    db.employee.findMany({
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        nickname: true,
        grade: true,
        businessUnit: true,
        remark: true,
        jobRoleId: true,
        managerId: true,
        department: { select: { name: true } },
        division: { select: { name: true } },
        position: { select: { name: true } },
        jobRole: { select: { name: true } },
      },
    }),
    db.department.findMany({ select: { id: true, name: true } }),
    db.division.findMany({ select: { name: true, department: { select: { name: true } } } }),
    db.position.findMany({ select: { name: true } }),
  ]);

  const roleOf = (v: string) => {
    // the career chart calls level 6 "Vision (C Level)"; the role is C Suite
    const n = /^(?:level)?6?(?:vision)?clevel$|^cxo$/.test(norm(v)) ? "csuite" : norm(v);
    return (
      jobRoles.find((r) => norm(r.name) === n || norm(r.key) === n) ??
      // "2. Senior", "Level 2: Senior Operation"
      jobRoles.find((r) => n.endsWith(norm(r.name)) || norm(r.level) === n) ??
      null
    );
  };
  // the career-path chart's track codes: SR2 is Senior, SP3 Specialist Lead,
  // EN1/EN2 (Engineer) sit with Executive at level 1. The general G01-G11
  // grades run across tracks, so they never decide a level on their own.
  const gradeParts = (g: string) => {
    const m = /^([A-Z]{2})\s*-?\s*(\d)$/.exec(g.trim().toUpperCase());
    return m ? { track: m[1]!, n: Number(m[2]) } : null;
  };
  const roleOfGrade = (g: string) => {
    const p = gradeParts(g);
    if (!p) return null;
    if (p.track === "EN") return jobRoles.find((r) => r.key === "executive") ?? null;
    return (
      jobRoles.find((r) => {
        const from = gradeParts(r.gradeFrom);
        const to = gradeParts(r.gradeTo);
        return from && to && from.track === p.track && p.n >= from.n && p.n <= to.n;
      }) ?? null
    );
  };
  const byCode = new Map(employees.map((e) => [ci(e.employeeCode), e]));
  const byEmail = new Map(employees.map((e) => [ci(e.email), e]));
  const roleNames = jobRoles.map((r) => r.name).join(", ");

  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const planned: Planned[] = [];

  for (const r of sheet.rows) {
    const problems: ImportMessage[] = [];
    const warnings: ImportMessage[] = [];
    const changes: ImportMessage[] = [];
    const code = (r.code ?? "").trim();
    const existing = code ? byCode.get(ci(code)) : undefined;

    if (!/^[0-9]{3,4}$/.test(code)) problems.push(msg("Employee_ID must be 3 to 4 digits.", "Employee_ID ต้องเป็นตัวเลข 3–4 หลักเท่านั้น"));
    else if (seenCodes.has(ci(code))) problems.push(msg(`Employee_ID ${code} appears earlier in the file.`, `Employee_ID ${code} ซ้ำกับแถวก่อนหน้าในไฟล์`));
    seenCodes.add(ci(code));

    const name = (r.name ?? [r.firstName, r.lastName].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
    const email = (r.email ?? "").trim().toLowerCase();
    const fromGrade = r.grade ? roleOfGrade(r.grade) : null;
    const role = r.level ? roleOf(r.level) : fromGrade;
    if (r.level && !role) problems.push(msg(`Unknown Level "${r.level}" — use one of: ${roleNames}`, `ไม่รู้จัก Level "${r.level}" — ใช้ได้: ${roleNames}`));
    if (role && fromGrade && fromGrade.id !== role.id) {
      warnings.push(msg(`Grade ${r.grade} belongs to ${fromGrade.name}, but Level says ${role.name} — Level is used.`, `Grade ${r.grade} เป็นของ ${fromGrade.name} แต่ Level ระบุ ${role.name} — ใช้ตาม Level`));
    }
    if (!r.level && fromGrade) warnings.push(msg(`No Level — ${fromGrade.name}, from Grade ${r.grade}.`, `ไม่มี Level — ใช้ ${fromGrade.name} ตาม Grade ${r.grade}`));
    if (!r.level && r.grade && !fromGrade && !existing) {
      problems.push(msg(`Grade "${r.grade}" does not say the level (G01–G11 span tracks) — add a Level.`, `Grade "${r.grade}" ไม่ได้บอกระดับ (G01–G11 ใช้ได้หลายสาย) — กรุณาระบุ Level`));
    }

    if (!existing) {
      if (!name) problems.push(msg("A new employee needs a Name.", "พนักงานใหม่ต้องมีชื่อ (Name)"));
      if (!email) problems.push(msg("A new employee needs an Email.", "พนักงานใหม่ต้องมีอีเมล (Email)"));
      if (!r.level && !r.grade) problems.push(msg("A new employee needs a Level (or a Grade that gives one, like SR2 or SP3).", "พนักงานใหม่ต้องมี Level (หรือ Grade ที่บอกระดับได้ เช่น SR2, SP3)"));
    }
    if (email) {
      if (!EMAIL.test(email)) problems.push(msg(`"${email}" is not a valid email.`, `อีเมล "${email}" ไม่ถูกต้อง`));
      const owner = byEmail.get(email);
      if (owner && owner.id !== existing?.id) problems.push(msg(`${email} belongs to ${owner.name} (${owner.employeeCode}).`, `อีเมล ${email} เป็นของ ${owner.name} (${owner.employeeCode})`));
      if (seenEmails.has(email)) problems.push(msg(`${email} appears earlier in the file.`, `อีเมล ${email} ซ้ำกับแถวก่อนหน้าในไฟล์`));
      seenEmails.add(email);
    }

    const data: Planned["data"] = { employeeCode: existing?.employeeCode ?? code };
    const diff = (label: string | [string, string], before: string | null | undefined, after: string | undefined) => {
      if (after === undefined || (before ?? "") === after) return false;
      const [en, th] = typeof label === "string" ? [label, label] : label;
      // a new person has nothing to change from: just say what they get
      const what = existing ? `${before || "—"} → ${after}` : after;
      changes.push(msg(`${en}: ${what}`, `${th}: ${what}`));
      return true;
    };
    if (name && diff(["Name", "ชื่อ"], existing?.name, name)) {
      const [first, ...rest] = name.split(" ");
      Object.assign(data, { name, firstName: first || null, lastName: rest.join(" ") || null });
    }
    if (email && diff(["Email", "อีเมล"], existing?.email, email)) data.email = email;
    if (role && diff("Level", existing?.jobRole.name, role.name)) data.jobRoleId = role.id;
    if (r.role && diff("Role", existing?.position?.name, r.role)) data.position = r.role;
    if (r.businessUnit && diff("Business Unit", existing?.businessUnit, r.businessUnit)) data.businessUnit = r.businessUnit;
    if (r.department && diff("Department", existing?.department?.name, r.department)) data.department = r.department;
    if (r.division && diff("Division", existing?.division?.name, r.division)) data.division = r.division;
    if (r.nickname && diff(["Nickname", "ชื่อเล่น"], existing?.nickname, r.nickname)) data.nickname = r.nickname;
    if (r.grade && diff("Grade", existing?.grade, r.grade)) data.grade = r.grade;
    if (r.remark && diff("Remark", existing?.remark, r.remark)) data.remark = r.remark;
    // a division is filed under a department: keep the pair together
    if (data.division && !data.department) data.department = r.department ?? existing?.department?.name ?? undefined;
    if (data.division && !data.department) problems.push(msg("A Division needs its Department.", "Division ต้องระบุ Department คู่กัน"));

    planned.push({
      line: r.line,
      code,
      name: name || existing?.name || "",
      action: problems.length ? "error" : existing ? "update" : "create",
      changes,
      problems,
      warnings,
      employeeId: existing?.id ?? null,
      data,
      managerCode: null,
      // carried for the second pass
      ...({ reportTo: r.reportTo } as object),
    } as Planned);
  }

  /* ----------------------------------------------- report-to, 2nd pass */

  // everyone the line could point at: the people already here, as the import
  // will leave them, plus the people it adds
  type Person = { code: string; email: string; name: string; position: string | null };
  const people = new Map<string, Person>();
  for (const e of employees) {
    people.set(ci(e.employeeCode), {
      code: e.employeeCode,
      email: ci(e.email),
      name: ci(e.name),
      position: e.position?.name ? ci(e.position.name) : null,
    });
  }
  for (const p of planned) {
    if (p.action === "error") continue;
    const before = people.get(ci(p.code));
    people.set(ci(p.code), {
      code: p.data.employeeCode,
      email: p.data.email ?? before?.email ?? "",
      name: ci(p.data.name ?? p.name),
      position: p.data.position ? ci(p.data.position) : (before?.position ?? null),
    });
  }
  const all = [...people.values()];
  const findManager = (v: string): Person | "ambiguous" | null => {
    const k = ci(v);
    const direct = people.get(k) ?? all.find((p) => p.email === k);
    if (direct) return direct;
    const named = all.filter((p) => p.name === k);
    if (named.length === 1) return named[0]!;
    const holding = all.filter((p) => p.position === k);
    if (holding.length === 1) return holding[0]!;
    return named.length > 1 || holding.length > 1 ? "ambiguous" : null;
  };

  const codeToId = new Map(employees.map((e) => [ci(e.employeeCode), e.id]));
  const managerOf = new Map(employees.map((e) => [e.id, e.managerId]));
  const idCode = new Map(employees.map((e) => [e.id, ci(e.employeeCode)]));

  for (const p of planned) {
    const reportTo = (p as unknown as { reportTo?: string }).reportTo;
    if (!reportTo || p.action === "error") continue;
    const m = findManager(reportTo);
    if (m === "ambiguous") {
      p.warnings.push(msg(`Report to "${reportTo}" matches several people — not set; use their Employee_ID.`, `Report to "${reportTo}" ตรงกับหลายคน — ไม่ได้กำหนดหัวหน้า ให้ใช้ Employee_ID แทน`));
      continue;
    }
    if (!m) {
      p.warnings.push(msg(`"${reportTo}" is not in the system or the file — supervisor not set.`, `ไม่พบ "${reportTo}" ในระบบหรือในไฟล์ — ไม่ได้กำหนดหัวหน้า`));
      continue;
    }
    if (ci(m.code) === ci(p.code)) {
      p.warnings.push(msg("Report to is the person themselves — supervisor not set.", "Report to เป็นตัวเอง — ไม่ได้กำหนดหัวหน้า"));
      continue;
    }
    const currentManagerCode = p.employeeId ? idCode.get(managerOf.get(p.employeeId) ?? "") : undefined;
    if (currentManagerCode === ci(m.code)) continue;
    // a line that loops back ("A reports to B reports to A") is refused
    let cursor: string | undefined = ci(m.code);
    let loops = false;
    for (let hops = 0; cursor && hops < 50; hops++) {
      if (cursor === ci(p.code)) {
        loops = true;
        break;
      }
      const planNext = planned.find((x) => ci(x.code) === cursor)?.managerCode;
      const id = codeToId.get(cursor);
      cursor = planNext ? ci(planNext) : id ? idCode.get(managerOf.get(id) ?? "") : undefined;
    }
    if (loops) {
      p.warnings.push(msg(`Report to ${m.code} would loop the reporting line back — not set.`, `Report to ${m.code} ทำให้สายบังคับบัญชาวนกลับมาที่ตัวเอง — ไม่ได้กำหนดหัวหน้า`));
      continue;
    }
    p.managerCode = m.code;
    p.changes.push(msg(`Report to → ${m.code}`, `Report to → ${m.code}`));
  }

  for (const p of planned) {
    if (p.action === "update" && !p.changes.length) p.action = "same";
  }

  /* ------------------------------------------------- org units to add */

  const haveDept = new Set(departments.map((d) => ci(d.name)));
  const haveDiv = new Set(divisions.map((d) => `${ci(d.department.name)}/${ci(d.name)}`));
  const havePos = new Set(positions.map((p) => ci(p.name)));
  const create = { departments: new Set<string>(), divisions: new Set<string>(), positions: new Set<string>() };
  for (const p of planned) {
    if (p.action === "error") continue;
    if (p.data.department && !haveDept.has(ci(p.data.department))) create.departments.add(p.data.department);
    if (p.data.division && p.data.department && !haveDiv.has(`${ci(p.data.department)}/${ci(p.data.division)}`)) {
      create.divisions.add(`${p.data.department} / ${p.data.division}`);
    }
    if (p.data.position && !havePos.has(ci(p.data.position))) create.positions.add(p.data.position);
  }

  const counts = { create: 0, update: 0, same: 0, error: 0 };
  for (const p of planned) counts[p.action] += 1;

  return {
    planned,
    plan: {
      rows: planned.map(({ line, code, name, action, changes, problems, warnings }) => ({
        line,
        code,
        name,
        action,
        changes,
        problems,
        warnings,
      })),
      counts,
      create: {
        departments: [...create.departments],
        divisions: [...create.divisions],
        positions: [...create.positions],
      },
      columns: sheet.columns,
    },
  };
}

