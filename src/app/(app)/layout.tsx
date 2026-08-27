"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNavProvider } from "@/components/layout/mobile-nav";
import { AppSkeleton } from "@/components/layout/AppSkeleton";
import { canAccess, HOME_FOR_ROLE } from "@/components/layout/nav";
import { useDemo } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, ready } = useDemo();
  const router = useRouter();
  const pathname = usePathname();

  const role = state.role;
  const allowed = role ? canAccess(role, pathname) : false;

  useEffect(() => {
    if (!ready) return;
    if (!role) {
      router.replace("/login");
      return;
    }
    // Role-based access control: bounce anyone who lands on a screen their role
    // does not own, rather than rendering it and hiding the data.
    if (!allowed) router.replace(HOME_FOR_ROLE[role]);
  }, [ready, role, allowed, router]);

  // a shell skeleton rather than a bare word - the layout is already known,
  // only the data is not
  if (!ready || !role || !allowed) return <AppSkeleton />;

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* every wide table and chart carries its own scroller, so nothing
              should be able to widen the page itself */}
          <main className="min-w-0 flex-1 overflow-x-clip pb-16">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
