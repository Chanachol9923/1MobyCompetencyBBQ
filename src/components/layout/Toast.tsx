"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/store";

const EXIT_MS = 180;

/**
 * The store clears `toast` to null, which would make the message vanish. We keep
 * a local copy alive for one exit animation so it slides out instead.
 */
export function Toast() {
  const { state } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (state.toast) {
      setMessage(state.toast);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(() => setMessage(null), EXIT_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state.toast]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex max-w-full items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-xl",
          leaving ? "animate-toast-out" : "animate-toast-in",
        )}
      >
        <CheckCircle2 size={16} className="shrink-0 text-success" />
        <span className="min-w-0">{message}</span>
      </div>
    </div>
  );
}
