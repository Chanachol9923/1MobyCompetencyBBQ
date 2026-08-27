import type { Role } from "@/data/people";

export type NavItem = { href: string; label: string; labelKey: string };

const item = (href: string, label: string, labelKey: string): NavItem => ({
  href,
  label,
  labelKey,
});

export const NAV: Record<Role, NavItem[]> = {
  l1: [
    item("/dashboard", "Dashboard", "nav.dashboard"),
    item("/idp", "IDP", "nav.idp"),
    item("/lms", "LMS", "nav.lms"),
    item("/achievements", "Achievements", "nav.achievements"),
    item("/assessment", "Assessment", "nav.assessment"),
    item("/reward", "Reward", "nav.reward"),
  ],
  l2: [
    item("/dashboard", "Dashboard", "nav.dashboard"),
    item("/team-profile", "Team Profile", "nav.teamProfile"),
    item("/idp", "IDP", "nav.idp"),
    item("/lms", "LMS", "nav.lms"),
    item("/achievements", "Achievements", "nav.achievements"),
    item("/assessment", "Assessment", "nav.assessment"),
    item("/reports", "Reports", "nav.reports"),
    item("/reward", "Reward", "nav.reward"),
  ],
  admin: [
    item("/admin", "Dashboard", "nav.dashboard"),
    item("/admin/lms", "LMS", "nav.lms"),
    item("/admin/employee", "Employee", "nav.employee"),
    item("/admin/assessment", "Assessment", "nav.assessment"),
    item("/admin/achievements", "Achievements", "nav.achievements"),
    item("/admin/reward", "Reward", "nav.reward"),
    item("/admin/announcement", "Announcement", "nav.announcement"),
    item("/reports", "Reports", "nav.reports"),
    item("/admin/audit", "Activity Log", "nav.auditLog"),
  ],
};

export const HOME_FOR_ROLE: Record<Role, string> = {
  l1: "/dashboard",
  l2: "/dashboard",
  admin: "/admin",
};

/**
 * Route-level access control, mirroring the requirement pack:
 *  - an employee sees only their own result, so the team/company gap report and
 *    the team profile are closed to them
 *  - the admin persona is a system account that is never assessed, so the
 *    learner screens are closed to it
 */
export function canAccess(role: Role, pathname: string): boolean {
  const isAdminArea = pathname.startsWith("/admin");
  if (role === "admin") return isAdminArea || pathname.startsWith("/reports");
  if (isAdminArea) return false;
  if (pathname.startsWith("/team-profile") || pathname.startsWith("/reports")) {
    return role === "l2";
  }
  return true;
}
