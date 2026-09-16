"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Smile, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useViewer } from "@/lib/viewer";
import { useT } from "@/lib/i18n";
import { navFor } from "./nav";
import { useMobileNav } from "./mobile-nav";
import { BottomNav, NAV_ICON } from "./BottomNav";
import { Logo } from "./Logo";

export function Sidebar() {
  const viewer = useViewer();
  const { t, tt } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useMobileNav();

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
            {viewer.jobRoleName ?? viewer.roleName ?? viewer.email}
          </span>
          {viewer.level ? (
            <span className="block truncate text-[10px] leading-tight text-white/85">
              ({viewer.level})
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          <Smile size={15} className="text-amber" />
          <button
            type="button"
            aria-label={t("action.logout")}
            onClick={() => {
              void signOut({ redirectTo: "/login" });
            }}
            className={cn(
              "rounded p-0.5 transition-colors hover:bg-white/20 focus-visible:outline-white",
              drawer && "grid size-11 place-items-center",
            )}
          >
            <LogOut size={15} />
          </button>
        </span>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto scroll-thin">
        {items.map((item) => {
          const Icon = NAV_ICON[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "block px-4 py-3.5 text-[15px] font-bold text-white transition-colors duration-150",
                "focus-visible:outline-white focus-visible:-outline-offset-2",
                drawer && "flex min-h-[52px] items-center gap-3",
                isActive(item.href) ? "bg-brand-dark" : "hover:bg-white/10",
              )}
            >
              {drawer && Icon ? (
                <Icon size={18} className="shrink-0 text-white/85" />
              ) : null}
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 text-[10px] text-white/60">
        {t("demo.notice")}
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
    </>
  );
}
