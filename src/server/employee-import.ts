"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { parseCsv } from "@/lib/csv-parse";
import { assertPermission, NotAuthorised, recordActivity } from "@/server/session";
import { syncCourseAssignments } from "@/server/course-assignment";
import type { ImportResult } from "@/components/admin/import-types";
import { MAX_ROWS, buildPlan, cellsSchema, ci, toCells } from "@/server/employee-import-plan";

/**
 * Bringing the staff list in from Excel or Google Sheets (brief §5: "Export
 * รายชื่อเป็น Excel หรือลิงก์กับ Google Sheet เพื่อเอาข้อมูลรายชื่อเข้าระบบ").
 *
 * The sheet uses the brief's data-set columns — Employee_ID, Level, Role,
 * Business Unit, Department, Division, Report to, Remark — plus Name and Email,
 * which a new person needs. Rows are matched on Employee_ID: an unknown ID is
 * added, a known one is updated with the cells that are filled in (an empty
 * cell never wipes anything). Departments, divisions and positions that do not
 * exist yet are created. "Report to" may be an employee ID, an email, a name
 * or a position title held by one person ("Chief Executive Officer").
 *
 * Every import is previewed first, and the plan is recomputed on the server
 * when it is applied: nothing the browser sends is trusted.
 */

const NO_HEADER: ImportResult = {
  ok: false,
  error: {
    en: "No header row with Employee_ID was found. Use the template: Employee_ID, Name, Email, Level, Role, Business Unit, Department, Division, Report to, Remark.",
    th: "ไม่พบแถวหัวตารางที่มี Employee_ID กรุณาใช้แม่แบบ: Employee_ID, Name, Email, Level, Role, Business Unit, Department, Division, Report to, Remark",
  },
};

async function guard(): Promise<{ ok: false; error: { en: string; th: string } } | { ok: true; viewer: Awaited<ReturnType<typeof assertPermission>> }> {
  try {
    return { ok: true, viewer: await assertPermission(PERMISSIONS.MANAGE_USERS) };
  } catch (err) {
    if (err instanceof NotAuthorised) {
      return { ok: false, error: { en: "You may not manage employees.", th: "คุณไม่มีสิทธิ์จัดการรายชื่อพนักงาน" } };
    }
    throw err;
  }
}

/** Read the sheet and say what an import would do, without changing anything. */
export async function previewEmployeeImport(input: { cells: unknown }): Promise<ImportResult> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = cellsSchema.safeParse(input?.cells);
  if (!parsed.success) {
    return { ok: false, error: { en: `The sheet is unreadable or over ${MAX_ROWS} rows.`, th: `อ่านไฟล์ไม่ได้ หรือมีเกิน ${MAX_ROWS} แถว` } };
  }
  const built = await buildPlan(toCells(parsed.data));
  if (!built) return NO_HEADER;
  return { ok: true, plan: built.plan, created: 0, updated: 0 };
}

/** Apply the import. The plan is worked out again here; rows with problems are left out. */
export async function applyEmployeeImport(input: { cells: unknown; source: string }): Promise<ImportResult> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = cellsSchema.safeParse(input?.cells);
  if (!parsed.success) {
    return { ok: false, error: { en: `The sheet is unreadable or over ${MAX_ROWS} rows.`, th: `อ่านไฟล์ไม่ได้ หรือมีเกิน ${MAX_ROWS} แถว` } };
  }
  const built = await buildPlan(toCells(parsed.data));
  if (!built) return NO_HEADER;
  const todo = built.planned.filter((p) => p.action === "create" || p.action === "update");

  // organisation units first, so every row can point at them
  const deptId = new Map<string, string>();
  for (const d of await db.department.findMany({ select: { id: true, name: true } })) deptId.set(ci(d.name), d.id);
  const ensureDept = async (name: string) => {
    const k = ci(name);
    if (!deptId.has(k)) deptId.set(k, (await db.department.create({ data: { name: name.trim() }, select: { id: true } })).id);
    return deptId.get(k)!;
  };
  const ensureDivision = async (dept: string, name: string) => {
    const departmentId = await ensureDept(dept);
    const found = await db.division.findFirst({
      where: { departmentId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    return found?.id ?? (await db.division.create({ data: { departmentId, name: name.trim() }, select: { id: true } })).id;
  };
  const ensurePosition = async (name: string, dept: string | null) => {
    const found = await db.position.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } }, select: { id: true } });
    if (found) return found.id;
    const departmentId = dept ? await ensureDept(dept) : null;
    return (await db.position.create({ data: { name: name.trim(), departmentId }, select: { id: true } })).id;
  };

  let created = 0;
  let updated = 0;
  const touched: string[] = [];
  const idOfCode = new Map<string, string>();
  for (const e of await db.employee.findMany({ select: { id: true, employeeCode: true } })) idOfCode.set(ci(e.employeeCode), e.id);

  for (const p of todo) {
    const d = p.data;
    const data = {
      ...(d.name ? { name: d.name, firstName: d.firstName ?? null, lastName: d.lastName ?? null } : {}),
      ...(d.email ? { email: d.email } : {}),
      ...(d.nickname ? { nickname: d.nickname } : {}),
      ...(d.grade ? { grade: d.grade } : {}),
      ...(d.businessUnit ? { businessUnit: d.businessUnit } : {}),
      ...(d.remark ? { remark: d.remark } : {}),
      ...(d.jobRoleId ? { jobRoleId: d.jobRoleId } : {}),
      ...(d.department ? { departmentId: await ensureDept(d.department) } : {}),
      ...(d.division && d.department ? { divisionId: await ensureDivision(d.department, d.division) } : {}),
      ...(d.position ? { positionId: await ensurePosition(d.position, d.department ?? null) } : {}),
    };
    if (p.employeeId) {
      if (Object.keys(data).length) await db.employee.update({ where: { id: p.employeeId }, data });
      updated += 1;
      touched.push(p.employeeId);
    } else {
      const row = await db.employee.create({
        data: {
          employeeCode: d.employeeCode,
          name: d.name!,
          firstName: d.firstName ?? null,
          lastName: d.lastName ?? null,
          email: d.email!,
          jobRoleId: d.jobRoleId!,
          ...data,
        },
        select: { id: true },
      });
      idOfCode.set(ci(d.employeeCode), row.id);
      created += 1;
      touched.push(row.id);
    }
  }
  // reporting lines last: a manager may be a row this same import added
  for (const p of todo) {
    if (!p.managerCode) continue;
    const id = idOfCode.get(ci(p.code));
    const managerId = idOfCode.get(ci(p.managerCode));
    if (id && managerId) await db.employee.update({ where: { id }, data: { managerId } });
  }

  // a new career level is a new expected level: assigned courses follow
  await syncCourseAssignments(touched).catch((err) => console.error("course assignment failed", err));
  await recordActivity({
    viewer: g.viewer,
    action: "Imported employees",
    targetType: "employee",
    targetLabel: input.source.slice(0, 120) || "sheet",
    detail: `${created} added, ${updated} updated, ${built.plan.counts.error} skipped`,
  });
  for (const p of ["/admin", "/admin/employee", "/admin/employee/accounts", "/admin/assessment", "/team-profile", "/reports", "/dashboard"]) {
    revalidatePath(p);
  }
  return { ok: true, plan: built.plan, created, updated };
}

/* -------------------------------------------------------- google sheet */

/**
 * The cells of a Google Sheet, from its share link. The sheet has to be shared
 * as "Anyone with the link can view"; only docs.google.com spreadsheet links
 * are fetched, so this cannot be pointed anywhere else.
 */
export async function fetchGoogleSheet(input: { url: string }): Promise<{ ok: true; cells: string[][] } | { ok: false; error: { en: string; th: string } }> {
  const g = await guard();
  if (!g.ok) return g;
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/[^?#]*)?(?:\?[^#]*)?(?:#(.*))?$/.exec(String(input?.url ?? "").trim());
  if (!m) {
    return {
      ok: false,
      error: { en: "Paste a Google Sheets link (docs.google.com/spreadsheets/…).", th: "กรุณาวางลิงก์ Google Sheets (docs.google.com/spreadsheets/…)" },
    };
  }
  const gid = /(?:^|[?&#])gid=(\d+)/.exec(String(input.url))?.[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
  try {
    const res = await fetch(exportUrl, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("text/csv")) {
      return {
        ok: false,
        error: {
          en: 'The sheet could not be read. Share it as "Anyone with the link can view", then try again.',
          th: 'อ่านชีตไม่ได้ กรุณาแชร์ชีตเป็น "ทุกคนที่มีลิงก์ดูได้" แล้วลองอีกครั้ง',
        },
      };
    }
    const text = await res.text();
    if (text.length > 5_000_000) return { ok: false, error: { en: "The sheet is too large.", th: "ชีตมีขนาดใหญ่เกินไป" } };
    return { ok: true, cells: parseCsv(text) };
  } catch {
    return { ok: false, error: { en: "Google Sheets did not answer. Try again.", th: "เชื่อมต่อ Google Sheets ไม่ได้ ลองอีกครั้ง" } };
  }
}
