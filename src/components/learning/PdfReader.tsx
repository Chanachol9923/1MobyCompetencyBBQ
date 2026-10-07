"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
type RenderTask = import("pdfjs-dist").RenderTask;

/** pdf.js is large: load it once, and only when somebody opens a PDF. */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
    const pdfjs = mod as unknown as typeof import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Read how many pages a PDF has — the admin upload form uses this. */
export async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await loadPdfjs();
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    return (await loading.promise).numPages;
  } finally {
    void loading.destroy();
  }
}

const ZOOMS = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * An in-app PDF reader: one page at a time, fitted to the width of the reader,
 * with page turning by button, keyboard or swipe and a zoom for small print.
 *
 * It reports every page it lands on through `onPage`; what that means (save
 * the page, finish the chapter at the last one) is the caller's business.
 */
export function PdfReader({
  url,
  initialPage = 1,
  onPage,
  onPageCount,
  title,
  className,
}: {
  url: string;
  initialPage?: number;
  onPage?: (page: number, pages: number) => void;
  onPageCount?: (pages: number) => void;
  title?: string;
  className?: string;
}) {
  const { tt } = useT();
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const task = useRef<RenderTask | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [width, setWidth] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rendering, setRendering] = useState(false);
  const [full, setFull] = useState(false);
  const [pageDraft, setPageDraft] = useState(String(page));

  // callbacks change identity on every parent render; the latest one is enough
  const report = useRef(onPage);
  report.current = onPage;
  const reportCount = useRef(onPageCount);
  reportCount.current = onPageCount;

  /* ------------------------------------------------------------- load */
  useEffect(() => {
    let cancelled = false;
    let loading: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | null = null;
    setState("loading");
    loadPdfjs()
      .then((pdfjs) => {
        loading = pdfjs.getDocument({ url });
        return loading.promise;
      })
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setPages(d.numPages);
        setPage((p) => Math.min(Math.max(1, p), d.numPages));
        setState("ready");
        reportCount.current?.(d.numPages);
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      task.current?.cancel();
      void (loading as { destroy(): Promise<void> } | null)?.destroy();
    };
  }, [url]);

  /* ----------------------------------------------------- fit to width */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----------------------------------------------------------- render */
  useEffect(() => {
    if (!doc || !width || !canvas.current) return;
    let cancelled = false;
    setRendering(true);
    doc
      .getPage(page)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const base = p.getViewport({ scale: 1 });
        const fit = (width - 2) / base.width;
        // on a wide screen a page at full width is too tall to read comfortably
        const scale = Math.min(fit, full ? 3 : 1.6) * zoom;
        const viewport = p.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const c = canvas.current;
        c.width = Math.floor(viewport.width * ratio);
        c.height = Math.floor(viewport.height * ratio);
        c.style.width = `${Math.floor(viewport.width)}px`;
        c.style.height = `${Math.floor(viewport.height)}px`;
        task.current?.cancel();
        const t = p.render({
          canvas: c,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        task.current = t;
        return t.promise;
      })
      .catch(() => {
        /* a cancelled render rejects — the next one is already on its way */
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, page, width, zoom, full]);

  /* ----------------------------------------------------- page changes */
  useEffect(() => {
    setPageDraft(String(page));
    if (pages) report.current?.(page, pages);
  }, [page, pages]);

  const go = useCallback(
    (to: number) => setPage((p) => (pages ? Math.min(pages, Math.max(1, to)) : p)),
    [pages],
  );

  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPage((p) => Math.min(pages || p, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [pages]);

  // a horizontal swipe turns the page on a phone
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.current?.requestFullscreen?.().catch(() => {});
  };

  const zoomIndex = ZOOMS.indexOf(zoom);
  const progress = pages ? Math.round((page / pages) * 100) : 0;

  return (
    <div
      ref={shell}
      tabIndex={0}
      aria-label={title ? `${title} — PDF` : "PDF"}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-line/70 bg-surface outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        full && "rounded-none border-0 bg-ink",
        className,
      )}
    >
      {/* toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b border-line/70 bg-white px-3 py-2",
          full && "border-white/10 bg-ink text-white",
        )}
      >
        <div className="flex items-center gap-1">
          <ToolButton
            label={tt("Previous page", "หน้าก่อนหน้า")}
            onClick={() => go(page - 1)}
            disabled={page <= 1 || state !== "ready"}
            dark={full}
          >
            <ChevronLeft size={16} />
          </ToolButton>
          <form
            className="flex items-center gap-1 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number.parseInt(pageDraft, 10);
              if (Number.isFinite(n)) go(n);
              else setPageDraft(String(page));
            }}
          >
            <input
              value={pageDraft}
              onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onBlur={() => {
                const n = Number.parseInt(pageDraft, 10);
                if (Number.isFinite(n)) go(n);
                else setPageDraft(String(page));
              }}
              inputMode="numeric"
              aria-label={tt("Page number", "เลขหน้า")}
              className={cn(
                "h-8 w-11 rounded-md border border-line bg-white text-center text-xs font-medium text-ink",
                full && "border-white/20 bg-white/10 text-white",
              )}
            />
            <span className={cn("text-muted", full && "text-white/70")}>
              / {pages || "–"}
            </span>
          </form>
          <ToolButton
            label={tt("Next page", "หน้าถัดไป")}
            onClick={() => go(page + 1)}
            disabled={page >= pages || state !== "ready"}
            dark={full}
            primary
          >
            <ChevronRight size={16} />
          </ToolButton>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ToolButton
            label={tt("Zoom out", "ย่อ")}
            onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)])}
            disabled={zoomIndex <= 0}
            dark={full}
          >
            <Minus size={15} />
          </ToolButton>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className={cn(
              "h-8 min-w-12 rounded-md px-1.5 text-xs font-medium text-muted hover:text-ink",
              full && "text-white/70 hover:text-white",
            )}
            aria-label={tt("Reset zoom", "รีเซ็ตการซูม")}
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton
            label={tt("Zoom in", "ขยาย")}
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])}
            disabled={zoomIndex >= ZOOMS.length - 1}
            dark={full}
          >
            <Plus size={15} />
          </ToolButton>
          <ToolButton
            label={full ? tt("Exit full screen", "ออกจากเต็มจอ") : tt("Full screen", "เต็มจอ")}
            onClick={toggleFull}
            dark={full}
          >
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </ToolButton>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download
            aria-label={tt("Download PDF", "ดาวน์โหลด PDF")}
            title={tt("Download PDF", "ดาวน์โหลด PDF")}
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-ink",
              full && "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Download size={15} />
          </a>
        </div>
      </div>

      {/* page */}
      <div
        ref={stage}
        className={cn(
          "scroll-thin relative flex-1 overflow-auto p-3 sm:p-5",
          full ? "max-h-none" : "max-h-[78vh] min-h-[360px]",
        )}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || zoom > 1) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5) {
            go(dx < 0 ? page + 1 : page - 1);
          }
        }}
      >
        {state === "error" ? (
          <div className="grid h-full min-h-[320px] place-items-center text-center">
            <div>
              <p className="text-sm font-bold text-ink">
                {tt("This PDF could not be shown here", "ไม่สามารถแสดง PDF นี้ในหน้านี้ได้")}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                {tt("Open it in a new tab", "เปิดในแท็บใหม่")}
              </a>
            </div>
          </div>
        ) : (
          <div className="flex min-w-fit justify-center">
            <canvas
              ref={canvas}
              className={cn(
                "block bg-white shadow-[0_4px_24px_rgba(16,24,40,.12)] transition-opacity",
                (state === "loading" || rendering) && "opacity-60",
              )}
            />
          </div>
        )}
        {state === "loading" ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="size-8 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          </div>
        ) : null}
      </div>

      {/* reading progress */}
      <div className={cn("h-1 w-full bg-line/60", full && "bg-white/10")}>
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  dark,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  dark?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-md transition disabled:opacity-35",
        primary
          ? "bg-brand text-white hover:brightness-110"
          : dark
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The first page of a PDF as a cover image. It renders only once the card
 * scrolls into view, and pdf.js asks for just the bytes page 1 needs.
 */
export function PdfThumb({ url, className }: { url: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    let loading: { destroy(): Promise<void> } | null = null;

    const draw = async () => {
      const pdfjs = await loadPdfjs();
      const task = pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: true });
      loading = task;
      const doc = await task.promise;
      const page = await doc.getPage(1);
      const c = canvas.current;
      if (cancelled || !c) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (el.clientWidth / base.width) * ratio;
      const viewport = page.getViewport({ scale });
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      await page.render({ canvas: c, viewport }).promise;
      if (!cancelled) setReady(true);
      void task.destroy();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        draw().catch(() => {});
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      void loading?.destroy();
    };
  }, [url]);

  return (
    <div ref={box} className={cn("overflow-hidden", className)}>
      <canvas
        ref={canvas}
        aria-hidden
        className={cn("block w-full transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
