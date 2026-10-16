"use client";

import { timeAgo } from "@/components/announcements/format";
import { useT } from "@/lib/i18n";

/**
 * "5m ago". The server and the browser render it a moment apart, so the text
 * may legitimately differ by a tick; React is told not to treat that as a
 * mismatch.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const { lang } = useT();
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {timeAgo(iso, lang)}
    </time>
  );
}
