"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Content that changes in place — a tab, a filter — eases in instead of
 * blinking. It is never remounted, so nothing typed into it is lost. (The page
 * not jumping when the content gets shorter is handled once for the whole app
 * by `StableHeight` in the shell.)
 */
export function SmoothPanel({
  swapKey,
  className,
  children,
}: {
  /** changes whenever the content is swapped for something else */
  swapKey: string;
  className?: string;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reducedMotion()) return;
    el.current?.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, [swapKey]);

  return (
    <div ref={el} className={className}>
      {children}
    </div>
  );
}
