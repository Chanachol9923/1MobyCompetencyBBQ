"use client";

import { useEffect } from "react";
import { Clock3 } from "lucide-react";
import { useUi } from "@/lib/ui-state";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ActionResult, UserStatusValue } from "@/components/admin/admin-types";

/**
 * How an admin screen answers "did that work?". Every server action returns
 * its message in both languages; this hands it to the app-wide toast — the
 * same place, the same look, on every screen — instead of a strip at the top
 * of a page the administrator may have scrolled away from.
 */
export function ResultBanner({
  result,
  onDismiss,
}: {
  result: ActionResult | null;
  onDismiss: () => void;
}) {
  const { tt } = useT();
  const { notify } = useUi();
  useEffect(() => {
    if (!result) return;
    notify(
      result.ok ? tt(result.message.en, result.message.th) : tt(result.error.en, result.error.th),
      result.ok ? "success" : "error",
    );
    onDismiss();
    // a new result object is the trigger; the language at that moment is used
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  return null;
}

export function StatusPill({ status }: { status: UserStatusValue }) {
  const { tt } = useT();
  if (status === "ACTIVE") {
    return <Pill tone="success">{tt("Active", "ใช้งานอยู่")}</Pill>;
  }
  if (status === "SUSPENDED") {
    return <Pill tone="danger">{tt("Suspended", "ถูกระงับ")}</Pill>;
  }
  return <Pill tone="warn">{tt("Awaiting activation", "รอเปิดใช้งาน")}</Pill>;
}

/**
 * When a permission change actually bites.
 *
 * Role and permission claims ride in the session JWT and are refreshed on a
 * five-minute TTL (`CLAIMS_TTL_MS` in `src/lib/auth.ts`). Server-side guards
 * read the database on every request, so anything *newly forbidden* is refused
 * at once; what lags by up to five minutes is the menu and the claims cached in
 * an already-signed-in browser. Saying so plainly beats an admin wondering why
 * the person on the phone still sees the old sidebar.
 */
export function PropagationNote({ className }: { className?: string }) {
  const { tt } = useT();
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted",
        className,
      )}
    >
      <Clock3 size={14} className="mt-0.5 shrink-0 text-brand" />
      <span>
        {tt(
          "Saved immediately. Access that was removed is blocked at once; menus of people already signed in update within five minutes, or on their next sign-in.",
          "บันทึกทันที สิทธิ์ที่ถูกถอนจะถูกปิดกั้นทันที ส่วนเมนูของผู้ที่เข้าสู่ระบบอยู่จะอัปเดตภายใน 5 นาที หรือเมื่อเข้าสู่ระบบครั้งถัดไป",
        )}
      </span>
    </p>
  );
}
