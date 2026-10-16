"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top while the next page is on its way, so a click is
 * answered at once even when the server takes a moment. It starts on any click
 * on an internal link and finishes when the address actually changes.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // same page (an in-page tab or anchor): nothing is loading
      if (url.pathname === window.location.pathname) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // the new page has arrived: run to the end, then fade away
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
  }, [pathname, search]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (state === "done") timer.current = window.setTimeout(() => setState("idle"), 400);
    // never spin forever if a navigation was cancelled
    if (state === "loading") timer.current = window.setTimeout(() => setState("idle"), 10000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
      <div
        className="h-full bg-accent shadow-[0_0_8px_rgba(240,81,35,.6)]"
        style={{
          width: state === "idle" ? "0%" : state === "loading" ? "80%" : "100%",
          opacity: state === "done" ? 0 : state === "idle" ? 0 : 1,
          transition:
            state === "loading"
              ? "width 2.5s cubic-bezier(.1,.7,.2,1), opacity 0.1s"
              : state === "done"
                ? "width 0.2s ease-out, opacity 0.3s 0.15s"
                : "none",
        }}
      />
    </div>
  );
}
