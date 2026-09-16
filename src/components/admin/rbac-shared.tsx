"use client";

import { AlertTriangle, CheckCircle2, Clock3, X } from "lucide-react";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ActionResult, UserStatusValue } from "@/components/admin/admin-types";

/**
 * The strip an admin screen uses to answer "did that work?".
 *
 * Server actions return their message in both languages, so the banner only has
 * to pick one — a refusal keeps the exact sentence the action produced, because
 * "you cannot suspend your own account" is more useful than "failed".
 */
export function ResultBanner({
  result,
  onDismiss,
}: {
  result: ActionResult | null;
  onDismiss: () => void;
}) {
  const { tt } = useT();
  if (!result) return null;
  const ok = result.ok;
  const text = ok ? tt(result.message.en, result.message.th) : tt(result.error.en, result.error.th);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "animate-enter mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm",
        ok
          ? "border-success/40 bg-success/10 text-ink"
          : "border-accent/40 bg-accent/10 text-ink",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", ok ? "text-success" : "text-accent")}>
        {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </span>
      <p className="min-w-0 flex-1 leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={tt("Dismiss", "ปิดข้อความ")}
        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-white/60 hover:text-ink max-lg:grid max-lg:size-11 max-lg:place-items-center"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function StatusPill({ status }: { status: UserStatusValue }) {
  const { tt } = useT();
  if (status === "ACTIVE") {
    return <Pill tone="success">{tt("Active", "ใช้งานอยู่")}</Pill>;
  }
  if (status === "SUSPENDED") {
    return <Pill tone="danger">{tt("Suspended", "ถูกระงับ")}</Pill>;
  }
  return <Pill tone="warn">{tt("Pending approval", "รออนุมัติ")}</Pill>;
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
          "Saved immediately. People who are already signed in pick the change up within five minutes — that is how long a session caches its permission claims — or straight away the next time they sign in.",
          "บันทึกทันที ผู้ที่กำลังเข้าสู่ระบบอยู่จะได้รับผลภายใน 5 นาที (ตามอายุของสิทธิ์ที่แคชไว้ในเซสชัน) หรือทันทีเมื่อเข้าสู่ระบบครั้งถัดไป",
        )}
      </span>
    </p>
  );
}
