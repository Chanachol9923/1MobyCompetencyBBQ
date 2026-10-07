"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useViewer } from "@/lib/viewer";
import { useT } from "@/lib/i18n";
import { navFor } from "./nav";
import { useMobileNav } from "./mobile-nav";
import { BottomNav, NAV_ICON } from "./BottomNav";
import { Logo } from "./Logo";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";

export function Sidebar() {
  const viewer = useViewer();
  const { t, tt, lang, lv } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useMobileNav();
  const [changingPassword, setChangingPassword] = useState(false);

  // the menu is derived from what this person may actually do, so an admin
  // changing a role changes the menu without a deploy
  const items = navFor(viewer);
  if (items.length === 0) return null;

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  /**
   * Same column for both surfaces. `drawer` only adds phone affordances —
   * destination icons, larger rows and home-indicator clearance — so the
   * desktop rail renders exactly as it did before.
   */
  const body = (drawer: boolean) => (
    <div
      className={cn(
        "flex h-full w-[250px] shrink-0 flex-col bg-brand",
        drawer && "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <Link
        href={items[0]!.href}
        className="flex h-[72px] items-center px-6 text-2xl focus-visible:outline-white focus-visible:-outline-offset-2"
        onClick={() => setOpen(false)}
      >
        <Logo className="text-2xl" />
      </Link>

      {/* user chip */}
      <div className="flex items-center gap-2 bg-accent px-3 py-2.5 text-white">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25">
          <User size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">
            {viewer.name}
          </span>
          <span className="block truncate text-[10px] leading-tight text-white/85">
            {viewer.jobRoleName ?? (lang === "th" ? (viewer.roleNameTh ?? viewer.roleName) : viewer.roleName) ?? viewer.email}
          </span>
          {viewer.level ? (
            <span className="block truncate text-[10px] leading-tight text-white/85">
              ({lv(viewer.level)})
            </span>
          ) : null}
        </span>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto scroll-thin">
        {items.map((item) => {
          const Icon = NAV_ICON[item.href];
          const inGroup = isActive(item.href);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={inGroup && !item.children ? "page" : undefined}
                className={cn(
                  "block px-4 py-3.5 text-[15px] font-bold text-white transition-colors duration-150",
                  "focus-visible:outline-white focus-visible:-outline-offset-2",
                  drawer && "flex min-h-[52px] items-center gap-3",
                  inGroup
                    ? item.children
                      ? "bg-brand-dark/60"
                      : "bg-brand-dark"
                    : "hover:bg-white/10",
                )}
              >
                {drawer && Icon ? (
                  <Icon size={18} className="shrink-0 text-white/85" />
                ) : null}
                {t(item.labelKey)}
              </Link>
              {item.children ? (
                <ul className={cn("pb-1", inGroup && "bg-brand-dark/60")}>
                  {item.children.map((child) => {
                    const current = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={() => setOpen(false)}
                          aria-current={current ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 py-2 pl-8 pr-4 text-sm text-white/85 transition-colors duration-150",
                            "focus-visible:outline-white focus-visible:-outline-offset-2",
                            drawer && "min-h-11 pl-11",
                            current
                              ? "bg-brand-dark font-bold text-white"
                              : "hover:bg-white/10 hover:text-white",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              current ? "bg-white" : "bg-white/40",
                            )}
                          />
                          {t(child.labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/15 px-4 py-3">
        <p className="truncate text-[11px] text-white/70" title={viewer.email}>
          {viewer.email}
        </p>
        <div className="mt-2 grid gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setChangingPassword(true);
            }}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white",
              drawer && "h-11",
            )}
          >
            <KeyRound size={15} />
            {tt("Change password", "เปลี่ยนรหัสผ่าน")}
          </button>
          <button
            type="button"
            onClick={() => void signOut({ redirectTo: "/login" })}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white",
              drawer && "h-11",
            )}
          >
            <LogOut size={15} />
            {t("action.logout")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen lg:block">{body(false)}</aside>

      {/* the trigger lives in the top bar; this is just the drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="animate-drawer-in h-full overflow-y-auto scroll-thin">
            {body(true)}
          </div>
          <button
            type="button"
            aria-label={tt("Close navigation", "ปิดเมนู")}
            className="animate-backdrop flex-1 bg-ink/40"
            onClick={() => setOpen(false)}
          >
            <X className="ml-4 mt-4 text-white" size={22} />
          </button>
        </div>
      ) : null}

      {/* phone tab bar — the primary way around the app below lg */}
      <BottomNav />

      {changingPassword ? (
        <ChangePasswordModal
          loginId={viewer.email}
          onClose={() => setChangingPassword(false)}
        />
      ) : null}
    </>
  );
}
