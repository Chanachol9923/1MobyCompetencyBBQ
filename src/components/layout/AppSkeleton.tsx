"use client";

import { Skeleton } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * What a page shows while its data is on the way. It renders inside the app
 * shell — the sidebar and top bar stay put — so a click answers at once with
 * the shape of the next screen instead of freezing on the old one.
 */
export function PageSkeleton() {
  const { tt } = useT();
  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">{tt("Loading", "กำลังโหลด")}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-3 w-72 max-w-full" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
  );
}
