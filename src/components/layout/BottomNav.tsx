"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Gift,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { Role } from "@/data/people";

/**
 * Phone navigation. A drawer alone is not how a phone app navigates, so the
 * four or five destinations that carry the demo narrative sit in a fixed bottom
 * bar; everything else stays reachable through the hamburger drawer in the top
 * bar. Hidden from `lg` up — the desktop sidebar is untouched.
 */

type Tab = { href: string; icon: LucideIcon };

const TABS: Record<Role, Tab[]> = {
  l1: [
    { href: "/dashboard", icon: LayoutDashboard },
    { href: "/assessment", icon: ClipboardCheck },
    { href: "/idp", icon: Target },
    { href: "/lms", icon: BookOpen },
    { href: "/reward", icon: Gift },
  ],
  l2: [
    { href: "/dashboard", icon: LayoutDashboard },
    { href: "/team-profile", icon: Users },
    { href: "/assessment", icon: ClipboardCheck },
    { href: "/idp", icon: Target },
    { href: "/lms", icon: BookOpen },
  ],
  admin: [
    { href: "/admin", icon: LayoutDashboard },
    { href: "/admin/employee", icon: Users },
    { href: "/admin/assessment", icon: ClipboardCheck },
    { href: "/admin/lms", icon: BookOpen },
    { href: "/admin/reward", icon: Gift },
  ],
};

/** Icons kept for the drawer-only destinations, so the vocabulary matches. */
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
  "/admin/announcement": Megaphone,
  "/admin/audit": ScrollText,
};

export function BottomNav() {
  const { state, person } = useDemo();
  const { tt } = useT();
  const pathname = usePathname();

  if (!state.role || !person) return null;
  const tabs = TABS[state.role];

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
        return tt("LMS", "หลักสูตร");
      case "/admin/employee":
        return tt("People", "พนักงาน");
      case "/reward":
      case "/admin/reward":
        return tt("Reward", "รางวัล");
      default:
        return href;
    }
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

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
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5",
                  "transition-colors duration-150 active:bg-surface",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-150",
                    active && "bg-brand-tint",
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
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
