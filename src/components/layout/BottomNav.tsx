"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Target,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewer } from "@/lib/viewer";
import { navFor } from "./nav";
import { useT } from "@/lib/i18n";

/**
 * Phone navigation. A drawer alone is not how a phone app navigates, so the
 * four or five destinations that carry the demo narrative sit in a fixed bottom
 * bar; everything else stays reachable through the hamburger drawer in the top
 * bar. Hidden from `lg` up — the desktop sidebar is untouched.
 */

/** One icon per destination, shared by the tab bar and the drawer. */
export const NAV_ICON: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/team-profile": Users,
  "/idp": Target,
  "/lms": BookOpen,
  "/achievements": Award,
  "/assessment": ClipboardCheck,
  "/reward": Gift,
  "/reports": BarChart3,
  "/admin": LayoutDashboard,
  "/admin/lms": BookOpen,
  "/admin/employee": Users,
  "/admin/assessment": ClipboardCheck,
  "/admin/achievements": Award,
  "/admin/reward": Gift,
  "/admin/audit": ScrollText,
  "/admin/problems": LifeBuoy,
  "/admin/users": UserCog,
  "/admin/roles": ShieldCheck,
  "/announcements": Megaphone,
};

export function BottomNav() {
  const viewer = useViewer();
  const { tt } = useT();
  const pathname = usePathname();

  // the first five destinations this person can reach
  const tabs = navFor(viewer).slice(0, 5);
  if (tabs.length === 0) return null;

  /** Short enough to sit under a 20px icon in both languages. */
  const label = (href: string) => {
    switch (href) {
      case "/dashboard":
      case "/admin":
        return tt("Home", "หน้าแรก");
      case "/team-profile":
        return tt("Team", "ทีม");
      case "/assessment":
      case "/admin/assessment":
        return tt("Assess", "ประเมิน");
      case "/idp":
        return tt("IDP", "แผนพัฒนา");
      case "/lms":
        return tt("Learn", "เรียนรู้");
      case "/admin/lms":
        return tt("Learn", "เรียนรู้");
      case "/admin/employee":
        return tt("People", "พนักงาน");
      case "/reward":
      case "/admin/reward":
        return tt("Reward", "รางวัล");
      case "/announcements":
        return tt("News", "ประกาศ");
      case "/achievements":
      case "/admin/achievements":
        return tt("Awards", "ความสำเร็จ");
      case "/reports":
        return tt("Reports", "รายงาน");
      case "/admin/users":
        return tt("Accounts", "บัญชี");
      case "/admin/roles":
        return tt("Roles", "บทบาท");
      case "/admin/audit":
        return tt("Log", "บันทึก");
      default:
        // a destination without a short label is a bug, but printing a raw
        // path on a phone tab is worse than printing nothing readable
        return href.split("/").filter(Boolean).pop() ?? href;
    }
  };

  // the tab just tapped lights up at once; the page follows a moment later
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const here = pending ?? pathname;
  const isActive = (href: string) =>
    href === "/admin" ? here === "/admin" : here === href || here.startsWith(href + "/");

  return (
    <nav
      aria-label={tt("Primary", "เมนูหลัก")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = NAV_ICON[tab.href] ?? LayoutDashboard;
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                onClick={() => {
                  if (tab.href !== pathname) setPending(tab.href);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5",
                  "transition-colors duration-150 active:bg-surface",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <span className="relative grid h-7 w-12 place-items-center">
                  {/* the pill grows in behind the icon of the chosen tab */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-full bg-brand-tint transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
                      active ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  />
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.4 : 2}
                    className={cn("relative transition-transform duration-300", active && "-translate-y-px")}
                  />
                </span>
                <span
                  className={cn(
                    "block max-w-full truncate text-[10px] leading-tight",
                    active ? "font-bold" : "font-medium",
                  )}
                >
                  {label(tab.href)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
