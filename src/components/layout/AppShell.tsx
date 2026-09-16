"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNavProvider } from "@/components/layout/mobile-nav";

/** The chrome around every signed-in page. Identity comes from ViewerProvider. */
export function AppShell({ children }: { children: ReactNode }) {
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
