"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeading,
  Pill,
  Select,
} from "@/components/ui";
import {
  CountTile,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  formatDateTime,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AuditFilters,
  AuditPage,
} from "@/components/admin/admin-types";
import { exportActivityCsv } from "@/server/admin-users";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The audit trail, read from `ActivityLog`.
 *
 * Filters and paging live in the URL and are answered by the query, not by the
 * browser: the page holds twenty-five rows whether the table has two hundred or
 * two hundred thousand. The CSV export re-runs the same filter server-side, so
 * what downloads is the filtered set rather than the page you happen to be on.
 */
export function AuditScreen({
  data,
  filters,
}: {
  data: AuditPage;
  filters: AuditFilters;
}) {
  const { t, tt } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startNavigation] = useTransition();
  const [exporting, startExport] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState(filters.q);

  /** The URL is the single source of truth for what the query asked for. */
  function apply(patch: Partial<AuditFilters & { page: number }>) {
    const merged = { ...filters, page: data.page, ...patch };
    const params = new URLSearchParams();
    if (merged.actorId) params.set("actor", merged.actorId);
    if (merged.action) params.set("action", merged.action);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.q) params.set("q", merged.q);
    // any filter change starts again at page one
    const page = patch.page ?? 1;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    startNavigation(() => router.replace(qs ? `${pathname}?${qs}` : pathname, {
      scroll: false,
    }));
  }

  // free text is debounced so a keystroke is not a database round trip
  useEffect(() => {
    if (query === filters.q) return;
    const handle = window.setTimeout(() => apply({ q: query }), 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => setQuery(filters.q), [filters.q]);

  const filtersOn = Boolean(
    filters.actorId || filters.action || filters.from || filters.to || filters.q,
  );

  function download() {
    startExport(async () => {
      const res = await exportActivityCsv(filters);
      if (!res.ok) {
        setResult({ ok: false, error: res.error });
        return;
      }
      const blob = new Blob(["﻿" + res.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `1moby-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResult({
        ok: true,
        message: {
          en: `Exported ${res.rows} row(s) matching the current filters.`,
          th: `ส่งออก ${res.rows} รายการตามตัวกรองปัจจุบันแล้ว`,
        },
      });
    });
  }

  const first = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.auditLog")}
        subtitle={tt(
          "Every change made in the system — who, what and when — newest first.",
          "ทุกการเปลี่ยนแปลงในระบบ ใครทำ ทำอะไร เมื่อไร เรียงจากใหม่ไปเก่า",
        )}
        right={
          <Button variant="outline" onClick={download} disabled={exporting || !data.total}>
            <Download size={15} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
        }
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={data.totalUnfiltered}
          label={tt("Recorded events", "เหตุการณ์ที่บันทึกไว้")}
          icon={<History size={20} />}
        />
        <CountTile
          value={data.actors.length}
          label={tt("Distinct actors", "ผู้ดำเนินการ")}
          tone="amber"
          icon={<User size={20} />}
        />
        <CountTile
          value={data.actions.length}
          label={tt("Action types", "ประเภทการกระทำ")}
          tone="success"
          icon={<ShieldCheck size={20} />}
        />
      </div>

      {/* ------------------------------------------------------- filters */}
      <Card className="mt-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">
              {t("action.search")}
            </span>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tt(
                "Search action, target or detail...",
                "ค้นหาการกระทำ เป้าหมาย หรือรายละเอียด...",
              )}
            />
          </div>
          <Field label={t("label.actor")}>
            <Select
              value={filters.actorId}
              onChange={(e) => apply({ actorId: e.target.value })}
            >
              <option value="">{tt("All actors", "ผู้ดำเนินการทั้งหมด")}</option>
              {data.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id === "system" ? tt("System", "ระบบ") : a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.action")}>
            <Select
              value={filters.action}
              onChange={(e) => apply({ action: e.target.value })}
            >
              <option value="">{tt("All actions", "การกระทำทั้งหมด")}</option>
              {data.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt("From", "ตั้งแต่วันที่")}>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => apply({ from: e.target.value })}
            />
          </Field>
          <Field label={tt("To", "ถึงวันที่")}>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => apply({ to: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {tt(
              `Showing ${first}–${last} of ${data.total} matching events (${data.totalUnfiltered} in total)`,
              `แสดง ${first}–${last} จาก ${data.total} เหตุการณ์ที่ตรงกับตัวกรอง (ทั้งหมด ${data.totalUnfiltered} รายการ)`,
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={!filtersOn}
            onClick={() =>
              apply({ actorId: "", action: "", from: "", to: "", q: "", page: 1 })
            }
          >
            <RotateCcw size={14} />
            {t("action.reset")}
          </Button>
        </div>
      </Card>

      {/* --------------------------------------------------------- table */}
      <Card className={cn("mt-5", navigating && "opacity-60")}>
        <TableWrap>
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-line/70 bg-surface/60">
                <Th className="w-44">{tt("Timestamp", "เวลา")}</Th>
                <Th className="w-44">{t("label.actor")}</Th>
                <Th>{t("label.action")}</Th>
                <Th>{t("label.target")}</Th>
                <Th>{t("label.detail")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(e.createdAt)}
                  </Td>
                  <Td>
                    <span className="block font-bold">{e.actorLabel}</span>
                    <span className="block text-[10px] text-muted">
                      {e.actorId ?? tt("system", "ระบบ")}
                    </span>
                  </Td>
                  <Td>
                    <Pill tone="brand">{e.action}</Pill>
                  </Td>
                  <Td>
                    <span className="block font-bold">{e.targetLabel ?? "—"}</span>
                    {e.targetType ? (
                      <span className="block text-[10px] text-muted">{e.targetType}</span>
                    ) : null}
                  </Td>
                  <Td className="max-w-[280px] text-muted">{e.detail ?? "—"}</Td>
                </tr>
              ))}
              {data.rows.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <EmptyState
                      title={
                        data.totalUnfiltered === 0
                          ? tt("No activity recorded yet", "ยังไม่มีการบันทึกกิจกรรม")
                          : t("admin.noMatch")
                      }
                      hint={
                        data.totalUnfiltered === 0
                          ? tt(
                              "Changes appear here as soon as someone makes them.",
                              "การเปลี่ยนแปลงจะปรากฏที่นี่ทันทีที่มีคนดำเนินการ",
                            )
                          : tt(
                              "Clear a filter or widen the date range.",
                              "ลองล้างตัวกรองหรือขยายช่วงวันที่",
                            )
                      }
                    />
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>

        {/* ---------------------------------------------------- paging */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 p-5">
          <p className="text-xs text-muted">
            {tt(
              `Page ${data.page} of ${data.pageCount}`,
              `หน้า ${data.page} จาก ${data.pageCount}`,
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={data.page <= 1 || navigating}
              onClick={() => apply({ page: data.page - 1 })}
            >
              <ChevronLeft size={14} />
              {tt("Previous", "ก่อนหน้า")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={data.page >= data.pageCount || navigating}
              onClick={() => apply({ page: data.page + 1 })}
            >
              {tt("Next", "ถัดไป")}
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <div className="border-t border-line/70 p-5">
          <Note>
            {tt(
              "Entries can never be edited or deleted, so the history cannot be rewritten. The export includes up to 5,000 entries matching the filters.",
              "รายการในบันทึกแก้ไขหรือลบไม่ได้ ประวัติจึงถูกแก้ย้อนหลังไม่ได้ การส่งออกรองรับสูงสุด 5,000 รายการตามตัวกรอง",
            )}
          </Note>
        </div>
      </Card>
    </div>
  );
}
