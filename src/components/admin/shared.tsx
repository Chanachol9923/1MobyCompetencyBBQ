"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AnimatedNumber, Button, Card, Input, ResponsiveTable } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";

/* --------------------------------------------------------------- guard */

/**
 * Wraps an admin screen. Anything that is not the admin role gets a small
 * "admin only" card with a way back to the dashboard. Together with the
 * per-role sidebar in `components/layout/nav.ts` this is the app's real RBAC
 * guard — the matrix on /admin/employee is a configuration surface only.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { state } = useDemo();
  const { t, tt } = useT();
  if (state.role !== "admin") {
    return (
      <div className="max-w-[1200px] p-6 lg:p-10">
        <Card className="max-w-md p-6">
          <h2 className="text-lg font-bold text-ink">
            {tt("Admin only", "สำหรับผู้ดูแลระบบเท่านั้น")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {tt(
              "This section is restricted to the administrator account. Sign in as Neo (Role Admin) to manage the organisation.",
              "ส่วนนี้จำกัดเฉพาะบัญชีผู้ดูแลระบบ กรุณาเข้าสู่ระบบด้วยบัญชี Neo (ผู้ดูแลระบบ) เพื่อจัดการองค์กร",
            )}
          </p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button>{t("nav.dashboard")}</Button>
          </Link>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ csv */

function esc(value: string | number) {
  const s = String(value ?? "");
  return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV client side and hands it to the browser through a Blob URL. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number)[][],
) {
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  // BOM keeps Excel happy with UTF-8 content.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------- layout */

/**
 * Every admin table goes through here, so this is where the phone rendering is
 * decided. From `lg` up it is the same horizontally scrolling table it always
 * was; below `lg` `ResponsiveTable` folds the very same rows into a stacked
 * card list (label/value pairs plus the row's actions) — a 12-column table is
 * not something you can drag sideways on a 375px screen.
 */
export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ResponsiveTable className={className}>{children}</ResponsiveTable>;
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn("px-4 py-3 align-middle text-xs text-ink", className)}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------- controls */

type IconActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "muted" | "brand" | "danger";
};

export function IconAction({ className, tone = "muted", ...props }: IconActionProps) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-lg border border-line bg-white transition-all duration-150",
        "active:scale-95",
        // icon-only controls get a full 44px target on phones
        "max-lg:size-11",
        tone === "muted" && "text-muted hover:bg-surface hover:text-ink",
        tone === "brand" && "text-brand hover:bg-brand-tint",
        tone === "danger" && "text-accent hover:bg-accent/10",
        className,
      )}
      {...props}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-line-2"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

/** The big number tiles used across the admin sections. */
export function CountTile({
  value,
  label,
  icon,
  tone = "brand",
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  tone?: "brand" | "amber" | "success" | "ink";
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon ? (
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            tone === "brand" && "bg-brand-tint text-brand",
            tone === "amber" && "bg-amber/15 text-amber",
            tone === "success" && "bg-success/10 text-success",
            tone === "ink" && "bg-surface text-ink",
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p
          className={cn(
            "text-3xl font-bold leading-none",
            tone === "brand" && "text-brand",
            tone === "amber" && "text-amber",
            tone === "success" && "text-success",
            tone === "ink" && "text-ink",
          )}
        >
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        </p>
        <p className="mt-1.5 truncate text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

/** Turns the tailwind gradient class strings in the seed data into a style. */
export function coverStyle(cover: string) {
  const hexes = cover.match(/#[0-9a-fA-F]{3,8}/g) ?? ["#006bff", "#0b1b3f"];
  const from = hexes[0]!;
  const to = hexes[hexes.length - 1]!;
  return { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function formatDate(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** `2026-04-30T08:12:00Z` -> `30-04-2026 15:12` in the viewer's locale time. */
export function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Local date part of an ISO timestamp, for date-range filtering. */
export function isoDatePart(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ------------------------------------------------------------- switches */

/** The pill switch used by the notification rules and the RBAC matrix. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** accessible name — the visible label lives next to the switch */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
        // the switch stays 20px tall but the tap area grows to 44px on phones
        "max-lg:after:absolute max-lg:after:-inset-x-2 max-lg:after:-inset-y-3 max-lg:after:content-['']",
        checked ? "bg-success" : "bg-line-2",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Small muted footnote used under the demo-level admin surfaces. */
export function Note({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
