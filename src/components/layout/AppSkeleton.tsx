"use client";

import { Skeleton } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * Shell placeholder for the moment before the store has rehydrated from
 * localStorage. It draws the sidebar rail, top bar and a page's worth of cards
 * so the app does not flash a bare "Loading…" and then jump into a full layout.
 */
export function AppSkeleton() {
  const { tt } = useT();
  return (
    <div className="flex min-h-screen bg-white" aria-busy="true" aria-live="polite">
      <span className="sr-only">{tt("Loading", "กำลังโหลด")}</span>

      {/* sidebar rail */}
      <aside className="hidden h-screen w-[250px] shrink-0 flex-col bg-brand lg:flex">
        <div className="flex h-[72px] items-center px-6">
          <Skeleton className="h-5 w-24 skeleton-invert" />
        </div>
        <div className="h-[62px] bg-accent/80" />
        <div className="mt-4 space-y-3 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-3/4 skeleton-invert" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <div className="flex h-14 items-center gap-2 border-b border-line px-3 max-lg:h-[60px] sm:px-4 lg:px-10">
          <Skeleton className="size-9 rounded-lg max-lg:size-11 lg:hidden" />
          <span className="flex-1" />
          <Skeleton className="h-9 w-24 rounded-lg max-lg:h-11" />
          <Skeleton className="size-9 rounded-lg max-lg:size-11" />
          <Skeleton className="hidden h-9 w-40 rounded-lg sm:block" />
        </div>

        {/* page */}
        <div className="max-w-[1200px] p-6 lg:p-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-3 w-72" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-line/70 bg-white p-4 shadow-[0_2px_10px_rgba(16,24,40,.06)]"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-6 w-16" />
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-line/70 bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,.06)] lg:col-span-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-48 w-full" />
            </div>
            <div className="rounded-xl border border-line/70 bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,.06)]">
              <Skeleton className="h-4 w-28" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
