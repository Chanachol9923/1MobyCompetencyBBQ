import { PERMISSIONS, can, type PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  labelKey: string;
  /** shown only when the viewer holds this permission */
  requires?: PermissionKey;
  /** shown only when the viewer is linked to a staff record */
  requiresEmployee?: boolean;
};

/**
 * One menu, filtered by what the viewer may actually do.
 *
 * Roles are rows in the database now, so a hard-coded per-role menu would go
 * stale the moment an admin edits a role. Every item states the permission it
 * needs and the menu is derived.
 */
const ALL_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    labelKey: "nav.dashboard",
    requires: PERMISSIONS.SEE_OWN_RESULT,
    requiresEmployee: true,
  },
  {
    href: "/team-profile",
    label: "Team Profile",
    labelKey: "nav.teamProfile",
    requires: PERMISSIONS.SEE_TEAM_RESULT,
    requiresEmployee: true,
  },
  {
    href: "/idp",
    label: "IDP",
    labelKey: "nav.idp",
    requires: PERMISSIONS.WORK_OWN_IDP,
    requiresEmployee: true,
  },
  {
    href: "/lms",
    label: "LMS",
    labelKey: "nav.lms",
    requires: PERMISSIONS.TAKE_COURSES,
    requiresEmployee: true,
  },
  {
    href: "/achievements",
    label: "Achievements",
    labelKey: "nav.achievements",
    requires: PERMISSIONS.REDEEM_REWARDS,
    requiresEmployee: true,
  },
  {
    href: "/assessment",
    label: "Assessment",
    labelKey: "nav.assessment",
    requires: PERMISSIONS.RUN_SELF_ASSESSMENT,
    requiresEmployee: true,
  },
  {
    href: "/announcements",
    label: "Announcements",
    labelKey: "nav.announcements",
  },
  {
    href: "/reports",
    label: "Reports",
    labelKey: "nav.reports",
    requires: PERMISSIONS.SEE_TEAM_RESULT,
  },
  {
    href: "/reward",
    label: "Reward",
    labelKey: "nav.reward",
    requires: PERMISSIONS.REDEEM_REWARDS,
    requiresEmployee: true,
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", labelKey: "nav.dashboard", requires: PERMISSIONS.MANAGE_USERS },
  { href: "/admin/lms", label: "LMS", labelKey: "nav.lms", requires: PERMISSIONS.MANAGE_LMS },
  { href: "/admin/employee", label: "Employee", labelKey: "nav.employee", requires: PERMISSIONS.MANAGE_USERS },
  { href: "/admin/users", label: "Accounts", labelKey: "nav.accounts", requires: PERMISSIONS.MANAGE_USERS },
  { href: "/admin/roles", label: "Roles", labelKey: "nav.roles", requires: PERMISSIONS.MANAGE_ROLES },
  { href: "/admin/assessment", label: "Assessment", labelKey: "nav.assessment", requires: PERMISSIONS.MANAGE_CYCLE },
  { href: "/admin/achievements", label: "Achievements", labelKey: "nav.achievements", requires: PERMISSIONS.MANAGE_REWARDS },
  { href: "/admin/reward", label: "Reward", labelKey: "nav.reward", requires: PERMISSIONS.MANAGE_REWARDS },
  { href: "/admin/announcement", label: "Announcement", labelKey: "nav.announcement", requires: PERMISSIONS.SEND_ANNOUNCEMENTS },
  { href: "/admin/audit", label: "Activity Log", labelKey: "nav.auditLog", requires: PERMISSIONS.VIEW_AUDIT_LOG },
];

export function navFor(viewer: {
  permissions: string[];
  employeeId: string | null;
}): NavItem[] {
  const keep = (item: NavItem) => {
    if (item.requiresEmployee && !viewer.employeeId) return false;
    if (item.requires && !can(viewer.permissions, item.requires)) return false;
    return true;
  };
  const staff = ALL_ITEMS.filter(keep);
  const admin = ADMIN_ITEMS.filter(keep);
  return [...staff, ...admin];
}

/** Where to send someone after signing in. */
export function homeFor(viewer: {
  permissions: string[];
  employeeId: string | null;
}): string {
  const items = navFor(viewer);
  return items[0]?.href ?? "/announcements";
}

/**
 * Route-level access control. Server layouts enforce the real thing; this keeps
 * the client from linking somewhere the server would only bounce it back from.
 */
export function canAccess(
  viewer: { permissions: string[]; employeeId: string | null },
  pathname: string,
): boolean {
  if (pathname === "/announcements" || pathname.startsWith("/announcements/")) return true;
  const items = [...ALL_ITEMS, ...ADMIN_ITEMS];
  // longest prefix wins so /admin/roles is not matched by /admin
  const match = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return true; // detail routes inherit their parent's guard
  if (match.requiresEmployee && !viewer.employeeId) return false;
  if (match.requires && !can(viewer.permissions, match.requires)) return false;
  return true;
}
