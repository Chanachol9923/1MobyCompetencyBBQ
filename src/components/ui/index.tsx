"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "amber";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-45",
        // phones: every button clears the 44px tap target
        size === "sm" && "h-8 px-3 text-xs max-lg:h-11 max-lg:px-3.5",
        size === "md" && "h-10 px-4 text-sm max-lg:h-11",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" &&
          "bg-brand text-white hover:bg-brand-dark active:scale-[.98] shadow-sm",
        variant === "secondary" &&
          "bg-brand-tint text-brand hover:bg-[#dbe9ff] active:scale-[.98]",
        variant === "amber" &&
          "bg-amber text-white hover:brightness-95 active:scale-[.98]",
        variant === "outline" &&
          "border border-line bg-white text-ink hover:bg-surface active:scale-[.98]",
        variant === "ghost" &&
          "text-muted hover:bg-surface hover:text-ink active:scale-[.98]",
        variant === "danger" &&
          "bg-accent text-white hover:brightness-95 active:scale-[.98]",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  animate = true,
  interactive = false,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  /** Set false for cards that mount inside an already-animating container. */
  animate?: boolean;
  /** Hover lift + press feedback. Inferred for cards that carry an onClick. */
  interactive?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const clickable = interactive || typeof rest.onClick === "function";
  return (
    <div
      className={cn(
        "rounded-xl border border-line/70 bg-white shadow-[0_2px_10px_rgba(16,24,40,.06)]",
        animate && "animate-enter",
        clickable &&
          "cursor-pointer transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-line hover:shadow-[0_6px_18px_rgba(16,24,40,.10)] active:translate-y-0 active:scale-[.995]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5", className)}>
      <div>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

/* -------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  delta,
  tone = "ink",
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  tone?: "ink" | "brand" | "success" | "amber";
  icon?: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      {icon ? (
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{label}</p>
        <p
          className={cn(
            "text-xl font-bold",
            tone === "brand" && "text-brand",
            tone === "success" && "text-success",
            tone === "amber" && "text-amber",
          )}
        >
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        </p>
      </div>
      {delta ? (
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
          {delta}
        </span>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  variant = "pill",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  variant?: "pill" | "underline" | "dark";
  className?: string;
}) {
  if (variant === "underline") {
    return (
      <div className={cn("flex gap-6 border-b border-line", className)}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors max-lg:min-h-11",
              value === o.value
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  if (variant === "dark") {
    return (
      <div
        className={cn(
          "inline-flex rounded-full bg-ink p-1 text-sm font-bold text-white",
          className,
        )}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-4 py-1.5 transition-colors active:scale-[.98] max-lg:min-h-11",
              value === o.value ? "bg-accent text-white" : "text-white/70 hover:text-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("inline-flex gap-1 rounded-lg bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors active:scale-[.98] max-lg:min-h-11",
            value === o.value
              ? "bg-brand text-white shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Pills */

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warn" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "bg-surface text-muted",
        tone === "brand" && "bg-brand-tint text-brand",
        tone === "success" && "border border-success/40 bg-success/10 text-success",
        tone === "warn" && "border border-amber/40 bg-amber/10 text-[#b57408]",
        tone === "danger" && "border border-accent/40 bg-accent/10 text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Progress */

export function Progress({
  value,
  className,
  tone = "brand",
  showLabel = false,
}: {
  value: number;
  className?: string;
  tone?: "brand" | "amber" | "success";
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            tone === "brand" && "bg-brand",
            tone === "amber" && "bg-amber",
            tone === "success" && "bg-success",
          )}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-10 shrink-0 text-right text-xs text-muted">{Math.round(v)}%</span>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-line-2/60 font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {letters}
    </span>
  );
}

/* ------------------------------------------------------------------ Modal */

/**
 * One dialog for the whole app.
 *
 * It is portalled to <body>, so no ancestor's transform, filter or overflow
 * can pin it to a corner of the page. Desktop: centred on screen, never taller
 * than the viewport, the body scrolls while the title and buttons stay put.
 * Phones: a sheet rising from the bottom edge. Escape or a click on the
 * backdrop closes it; focus moves into the dialog, stays inside while it is
 * open, and returns to whatever opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const { tt } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // focus the first field (or the dialog itself) once it is on screen
    const focusTimer = window.setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const auto = root.querySelector<HTMLElement>("[autofocus]");
      const first = root.querySelector<HTMLElement>(
        "[data-modal-body] input:not([type=hidden]):not([disabled]), [data-modal-body] select:not([disabled]), [data-modal-body] textarea:not([disabled])",
      );
      (auto ?? first ?? root).focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // keep Tab inside the dialog
      const items = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    // lock the page behind, without the layout jumping when the scrollbar goes
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "animate-backdrop fixed inset-0 z-50 flex bg-ink/45",
        // desktop and tablet: centred, with breathing room
        "sm:items-center sm:justify-center sm:p-6",
        // phones: a sheet anchored to the bottom edge
        "max-sm:items-end",
      )}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        // only a click that both starts and ends on the backdrop closes it,
        // so selecting text in a field and releasing outside does not
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
        pressedOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex w-full flex-col bg-white shadow-2xl outline-none",
          "sm:animate-fade-up sm:max-h-[min(88dvh,900px)] sm:rounded-2xl",
          "max-sm:animate-sheet-up max-sm:max-h-[92dvh] max-sm:rounded-t-2xl",
          width,
          "max-sm:max-w-none",
        )}
      >
        {/* grab handle — reads as a sheet on touch devices */}
        <span
          aria-hidden
          className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-line-2 sm:hidden"
        />
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tt("Close", "ปิด")}
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink max-sm:size-11"
          >
            <X size={18} />
          </button>
        </div>
        <div
          data-modal-body
          className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
        >
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-6 py-4 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const fieldBase =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-line-2 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "max-lg:min-h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldBase, "cursor-pointer max-lg:min-h-11", className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- Empty */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center gap-1 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- PageHeading */

export function PageHeading({
  title,
  right,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

/** Grey shimmering placeholder. `w`/`h` are Tailwind classes on `className`. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("skeleton block rounded-md", className)}
    />
  );
}

/** A few skeleton lines, last one short, the way real copy wraps. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span className={cn("block space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-1/2" : "w-full")}
        />
      ))}
    </span>
  );
}

/** Card-shaped placeholder used while a panel's data is resolving. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line/70 bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,.06)]",
        className,
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText className="mt-4" lines={3} />
    </div>
  );
}

/* --------------------------------------------------------- AnimatedNumber */

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Eases between two values when the number changes. The first render paints the
 * real value (so SSR and hydration agree and nothing flashes) — only subsequent
 * changes are animated.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 420,
  format,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // ease-out cubic — fast start, soft landing, no overshoot
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  const text = format ? format(shown) : shown.toFixed(decimals);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

/* --------------------------------------------------- ResponsiveTable / cards
   A twelve-column table is unusable on a phone, so the same rows are rendered
   twice: the untouched <table> from `lg` up, and a stacked card list below it.
   The card list is derived from the table's own markup — every cell keeps the
   exact React children it had in the row, so buttons, selects and toggles carry
   on working in both renderings and callers do not have to describe their data
   twice. -------------------------------------------------------------------- */

type CellProps = {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
};

/** Flattens fragments and arrays into a plain list of elements. */
function flattenElements(node: ReactNode): ReactElement<CellProps>[] {
  const out: ReactElement<CellProps>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(
        ...flattenElements((child.props as { children?: ReactNode }).children),
      );
      return;
    }
    out.push(child as ReactElement<CellProps>);
  });
  return out;
}

const findTag = (els: ReactElement<CellProps>[], tag: string) =>
  els.find((e) => e.type === tag);

/** Header labels that mean "this column holds the row's controls". */
const ACTION_HEADERS = new Set([
  "actions",
  "action",
  "การจัดการ",
  "การกระทำ",
]);

const isActionHeader = (header?: ReactElement<CellProps>) => {
  const c = header?.props.children;
  return typeof c === "string" && ACTION_HEADERS.has(c.trim().toLowerCase());
};

export function ResponsiveTable({
  children,
  className,
  cardClassName,
}: {
  /** A single `<table>` element. */
  children: ReactNode;
  className?: string;
  cardClassName?: string;
}) {
  const table = findTag(flattenElements(children), "table");

  const desktop = (
    <div className={cn("scroll-thin overflow-x-auto max-lg:hidden", className)}>
      {children}
    </div>
  );

  /** Not a shape we know how to fold — keep the scroller at every width. */
  const scrollerOnly = (
    <div className={cn("scroll-thin overflow-x-auto", className)}>{children}</div>
  );

  if (!table) return scrollerOnly;

  const sections = flattenElements(table.props.children);
  const thead = findTag(sections, "thead");
  const tbody = findTag(sections, "tbody");

  const headerRow = thead
    ? flattenElements(thead.props.children).filter((e) => e.type === "tr").pop()
    : undefined;
  const headers = headerRow ? flattenElements(headerRow.props.children) : [];

  // rows live in <tbody>, or directly under <table> if the caller skipped it
  const rows = (
    tbody ? flattenElements(tbody.props.children) : sections
  ).filter((e) => e.type === "tr");

  if (rows.length === 0) return scrollerOnly;

  return (
    <>
      {desktop}

      <ul className="space-y-3 p-4 lg:hidden">
        {rows.map((row, rowIndex) => {
          const cells = flattenElements(row.props.children);
          const key = row.key ?? `row-${rowIndex}`;

          // A single wide cell is either a group band or the empty state.
          if (cells.length === 1 && Number(cells[0]!.props.colSpan ?? 1) > 1) {
            return (
              <li
                key={key}
                className="rounded-lg bg-surface/70 px-3 py-2 text-center text-xs text-muted"
              >
                {cells[0]!.props.children}
              </li>
            );
          }

          const [first, ...rest] = cells;
          const detail = rest.filter((_, i) => !isActionHeader(headers[i + 1]));
          const actions = rest.filter((_, i) => isActionHeader(headers[i + 1]));

          return (
            <li
              key={key}
              className={cn(
                "animate-enter rounded-xl border border-line/70 bg-white p-4 shadow-[0_2px_10px_rgba(16,24,40,.06)]",
                cardClassName,
              )}
            >
              {first ? (
                <div className="text-sm font-bold text-ink">
                  {first.props.children}
                </div>
              ) : null}

              {detail.length ? (
                <dl className="mt-3 space-y-2">
                  {detail.map((cell, i) => {
                    const label = headers[cells.indexOf(cell)]?.props.children;
                    return (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 border-t border-line/50 pt-2 first:border-0 first:pt-0"
                      >
                        <dt className="shrink-0 text-[11px] font-medium text-muted">
                          {label}
                        </dt>
                        <dd className="min-w-0 flex-1 text-right text-xs text-ink">
                          {cell.props.children}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : null}

              {actions.length ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line/60 pt-3">
                  {actions.map((cell, i) => (
                    <Fragment key={i}>{cell.props.children}</Fragment>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
