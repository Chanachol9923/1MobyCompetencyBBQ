/**
 * The shapes the account / role / audit screens exchange with the server.
 *
 * They live outside `src/server/admin-users.ts` on purpose: that module carries
 * `"use server"`, and a `"use server"` file may only export async functions.
 * Keeping the vocabulary here lets the client components import it as a plain
 * type module with no runtime cost.
 */

export type UserStatusValue = "PENDING" | "ACTIVE" | "SUSPENDED";

/**
 * Server actions answer in both languages. The action knows which role was
 * renamed or which permission was refused; the client only knows which language
 * to show, so the pair travels with the result instead of a key the dictionary
 * would have to interpolate.
 */
export type Bilingual = { en: string; th: string };

/** What a server action hands back. Expected failures are values, not throws. */
export type ActionResult =
  | { ok: true; message: Bilingual }
  | { ok: false; error: Bilingual };

/* ------------------------------------------------------------------ users */

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  status: UserStatusValue;
  roleId: string | null;
  roleKey: string | null;
  roleNameEn: string | null;
  roleNameTh: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  jobRoleName: string | null;
  /** first sign-in, ISO */
  createdAt: string;
  /** true for the row that is the signed-in admin themselves */
  isSelf: boolean;
};

export type RoleSummary = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
  userCount: number;
  permissionIds: string[];
};

export type EmployeeOption = {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  jobRoleName: string;
  departmentName: string | null;
};

export type UsersScreenData = {
  rows: AdminUserRow[];
  roles: RoleSummary[];
  counts: { pending: number; active: number; suspended: number; total: number };
};

export type EmployeePickerData = {
  options: EmployeeOption[];
  /** the employee whose email matches this user, when there is one */
  suggestedId: string | null;
  /** true when more rows exist than were returned */
  truncated: boolean;
};

/* ------------------------------------------------------------------ roles */

export type PermissionRow = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  category: string;
  descEn: string | null;
  descTh: string | null;
  /** the clause of the requirement pack this permission traces back to */
  source: string | null;
};

export type RolesScreenData = {
  roles: RoleSummary[];
  permissions: PermissionRow[];
  /** the role the signed-in admin holds, so the UI can warn before it bites */
  viewerRoleId: string | null;
};

/* ------------------------------------------------------------------ audit */

export type AuditRow = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetLabel: string | null;
  detail: string | null;
};

export type AuditFilters = {
  actorId: string;
  action: string;
  from: string;
  to: string;
  q: string;
};

export type AuditPage = {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** distinct values present in the table, so a filter never offers a dead option */
  actors: { id: string; label: string }[];
  actions: string[];
  totalUnfiltered: number;
};

export const AUDIT_PAGE_SIZE = 25;
