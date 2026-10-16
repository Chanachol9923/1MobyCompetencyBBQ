"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Keeps the page from jumping when what is on it gets shorter.
 *
 * Choosing a filter or a tab that shows less content used to shrink the page
 * at once; if you had scrolled down, the browser yanked you upward. Here the
 * shrink is caught before it is painted: the old height is held, the scroll
 * position put back, and the height then eases down to its new size. A real
 * page change is left alone — that is supposed to start at the top.
 */
export function StableHeight({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const navigatedAt = useRef(0);
  const lastHeight = useRef(0);
  const lastScroll = useRef(0);
  const holding = useRef<number | null>(null);

  useEffect(() => {
    navigatedAt.current = performance.now();
  }, [pathname]);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    lastHeight.current = i.offsetHeight;
    lastScroll.current = window.scrollY;

    const onScroll = () => {
      if (holding.current === null) lastScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const release = () => {
      o.style.transition = "";
      o.style.minHeight = "";
      holding.current = null;
      lastHeight.current = i.offsetHeight;
      lastScroll.current = window.scrollY;
    };

    const ro = new ResizeObserver(() => {
      const now = i.offsetHeight;
      const before = lastHeight.current;
      const justNavigated = performance.now() - navigatedAt.current < 600;
      if (now >= before - 4 || justNavigated || reduced.matches || holding.current !== null) {
        if (holding.current === null) lastHeight.current = now;
        return;
      }
      // shorter, and not because of a new page: hold, put the scroll back,
      // then let the height settle smoothly
      o.style.transition = "none";
      o.style.minHeight = `${before}px`;
      window.scrollTo({ top: lastScroll.current, behavior: "instant" as ScrollBehavior });
      void o.offsetHeight;
      o.style.transition = "min-height 320ms cubic-bezier(.2,.8,.2,1)";
      o.style.minHeight = `${now}px`;
      holding.current = window.setTimeout(release, 360);
    });
    ro.observe(i);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (holding.current !== null) window.clearTimeout(holding.current);
    };
  }, []);

  return (
    <div ref={outer}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
