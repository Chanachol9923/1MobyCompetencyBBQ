"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useUi, type ToastMessage } from "@/lib/ui-state";

const EXIT_MS = 180;

/**
 * The one place every "did that work?" answer appears, bottom centre, above
 * the phone tab bar. The store clears `toast` to null, which would make the
 * message vanish; a local copy is kept for one exit animation instead.
 */
export function Toast() {
  const { toast, dismissToast } = useUi();
  const { tt } = useT();
  const [shown, setShown] = useState<ToastMessage | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (toast) {
      setShown(toast);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(() => setShown(null), EXIT_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [toast]);

  if (!shown) return null;
  const error = shown.tone === "error";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl",
          error ? "bg-accent" : "bg-ink",
          leaving ? "animate-toast-out" : "animate-toast-in",
        )}
      >
        {error ? (
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
        )}
        <span className="min-w-0 flex-1 leading-relaxed">{shown.message}</span>
        <button
          type="button"
          onClick={dismissToast}
          aria-label={tt("Dismiss", "ปิด")}
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
