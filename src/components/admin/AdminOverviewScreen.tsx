"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Download,
  Gift,
  Mail,
  Radio,
  Trophy,
} from "lucide-react";
import { Card, CardHeader, Modal, PageHeading, Pill, Progress } from "@/components/ui";
import { Donut, DonutLegend, type DonutSlice } from "@/components/charts";
import {
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  formatDate,
  formatDateTime,
  saveCsv,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AdminOverviewData,
  OverviewEmployeeRow,
} from "@/components/admin/content-types";
import { exportOrgSkillsCsv, remindEmployee } from "@/server/admin-content";
import { PERMISSIONS } from "@/lib/permissions";
import { usePermission } from "@/lib/viewer";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

const DONUT_COLORS = ["#faa21b", "#006bff", "#f05123", "#00b916", "#7a5af8", "#0b1b3f"];

/**
 * The administrator's overview.
 *
 * Every figure here is derived on the server in a handful of queries: the
 * submission counts are `Assessment` rows in the open cycle, the donut is a real
 * headcount per department, and each person's skill index and phase come from
 * their career role's expected levels crossed with this cycle's scores — which
 * is why somebody whose role is assessed on nine competencies and has six scored
 * reads 67%, not "6".
 */
export function AdminOverviewScreen({ data }: { data: AdminOverviewData }) {
  const { t, tt, lang } = useT();
  const { can } = usePermission();
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OverviewEmployeeRow | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  const { cycle, counts, departments, employees, activity } = data;

  const canExport = can(PERMISSIONS.EXPORT_EMPLOYEE_LIST);
  const canRemind = can(PERMISSIONS.MANAGE_CYCLE);

  const MANAGEMENT_TILES = [
    {
      href: "/admin/assessment",
      label: t("nav.assessment"),
      hint: tt("Cycle, weighting, framework", "รอบประเมิน น้ำหนัก กรอบสมรรถนะ"),
      icon: ClipboardList,
      requires: PERMISSIONS.MANAGE_CYCLE,
    },
    {
      href: "/admin/lms",
      label: t("nav.lms"),
      hint: tt("Courses and chapters", "หลักสูตรและบทเรียน"),
      icon: BookOpen,
      requires: PERMISSIONS.MANAGE_LMS,
    },
    {
      href: "/admin/achievements",
      label: t("nav.achievements"),
      hint: tt("Badges and holders", "เหรียญตราและผู้ถือครอง"),
      icon: Trophy,
      requires: PERMISSIONS.MANAGE_REWARDS,
    },
    {
      href: "/admin/reward",
      label: t("nav.reward"),
      hint: tt("Catalogue and fulfilment", "รายการของรางวัลและการส่งมอบ"),
      icon: Gift,
      requires: PERMISSIONS.MANAGE_REWARDS,
    },
  ].filter((tile) => can(tile.requires));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((p) =>
      [
        p.name,
        p.nickname ?? "",
        p.positionName ?? "",
        p.jobRoleName,
        p.departmentName ?? "",
        p.employeeCode,
      ].some((v) => v.toLowerCase().includes(q)),
    );
  }, [employees, query]);

  const slices: DonutSlice[] = departments.map((d, i) => ({
    name: d.name,
    value: d.headcount,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));

  /** How far through the cycle window today is, 0-100. */
  const elapsed = useMemo(() => {
    if (!cycle) return 0;
    const start = new Date(`${cycle.startsAt}T00:00:00`).getTime();
    const end = new Date(`${cycle.endsAt}T00:00:00`).getTime();
    if (end <= start) return 100;
    return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }, [cycle]);

  const statusLabel = (s: "complete" | "on-track" | "follow-up") =>
    s === "complete"
      ? t("label.complete")
      : s === "on-track"
        ? t("status.onTrack")
        : t("status.needsFollowUp");

  function exportOrg() {
    startTransition(async () => {
      const res = await exportOrgSkillsCsv();
      if (!res.ok) {
        setResult({ ok: false, error: res.error });
        return;
      }
      saveCsv(
        `1moby-org-skills-${new Date().toISOString().slice(0, 10)}.csv`,
        res.csv,
      );
      setResult({
        ok: true,
        message: {
          en: `Exported ${res.rows} employees as CSV.`,
          th: `ส่งออกข้อมูลพนักงาน ${res.rows} คนเป็น CSV แล้ว`,
        },
      });
    });
  }

  function remind(p: OverviewEmployeeRow) {
    startTransition(async () => setResult(await remindEmployee({ employeeId: p.id })));
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Admin Overview", "ภาพรวมผู้ดูแลระบบ")}
        subtitle={tt(
          "Cycle progress, organisation shape and every person's derived numbers.",
          "ความคืบหน้าของรอบประเมิน โครงสร้างองค์กร และตัวเลขที่คำนวณได้ของพนักงานแต่ละคน",
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* -------------------------------------------- cycle + org chart */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <CalendarClock size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-ink">
                  {cycle
                    ? tt(
                        `${cycle.nameEn} — assessment cycle monitoring`,
                        `การติดตามรอบการประเมิน ${cycle.nameTh}`,
                      )
                    : tt("No assessment cycle yet", "ยังไม่มีรอบการประเมิน")}
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  {cycle
                    ? `${formatDate(cycle.startsAt)} → ${formatDate(cycle.endsAt)}`
                    : tt(
                        "Create one on the Assessment screen.",
                        "สร้างได้ที่หน้าจัดการการประเมิน",
                      )}
                </p>
              </div>
            </div>
            {cycle ? (
              <div className="text-right">
                <p className="text-sm font-bold text-ink">
                  {tt("Time Remaining", "เวลาที่เหลือ")}
                </p>
                <p className="text-xl font-bold text-brand">
                  {tt(`${cycle.daysRemaining} Days`, `${cycle.daysRemaining} วัน`)}
                </p>
              </div>
            ) : null}
          </div>

          {cycle ? (
            <div className="mt-6">
              <Progress value={elapsed} tone={elapsed >= 90 ? "amber" : "brand"} />
              <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
                <span>{tt("Opened", "เปิดรอบ")} {formatDate(cycle.startsAt)}</span>
                <span className="text-brand">
                  {tt(`${Math.round(elapsed)}% elapsed`, `ผ่านไป ${Math.round(elapsed)}%`)}
                </span>
                <span>{tt("Closes", "ปิดรอบ")} {formatDate(cycle.endsAt)}</span>
              </div>
            </div>
          ) : null}

          {/* mini stats */}
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: tt("Self assessments in", "ประเมินตนเองที่ส่งแล้ว"),
                value: `${counts.selfSubmitted} / ${counts.headcount}`,
                tone: "text-brand",
              },
              {
                label: tt("Supervisor reviews in", "หัวหน้าประเมินที่ส่งแล้ว"),
                value: `${counts.supervisorSubmitted} / ${counts.headcount}`,
                tone: "text-amber",
              },
              {
                label: tt("LMS certificates issued", "ใบรับรองที่ออกแล้ว"),
                value: formatNumber(counts.certificates),
                tone: "text-success",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-line/70 px-4 py-3 text-center"
              >
                <p className="text-sm font-bold text-ink">{s.label}</p>
                <p className={cn("mt-1 text-lg font-bold", s.tone)}>{s.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-center text-base font-bold text-ink">
            {tt("Organization Structure", "โครงสร้างองค์กร")}
          </h3>
          <div className="mt-3 grid place-items-center">
            <Donut
              data={slices}
              total={counts.headcount}
              totalLabel={tt("TOTAL STAFF", "พนักงานทั้งหมด")}
              size={190}
            />
          </div>
          <div className="mt-5">
            <DonutLegend data={slices} />
          </div>
        </Card>
      </div>

      {/* --------------------------------------------- management center */}
      {MANAGEMENT_TILES.length ? (
        <div
          className="mt-5 rounded-xl p-6"
          style={{
            backgroundImage:
              "linear-gradient(100deg, #006bff 0%, #6f9ede 48%, #f2bd6e 100%)",
          }}
        >
          <h3 className="text-base font-bold text-white">
            {tt("Management Center", "ศูนย์จัดการระบบ")}
          </h3>
          <p className="mt-1 text-xs text-white/80">
            {tt(
              "Only the sections your role can actually administer are shown.",
              "แสดงเฉพาะส่วนที่บทบาทของคุณมีสิทธิ์จัดการเท่านั้น",
            )}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {MANAGEMENT_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/15 px-4 py-4 text-left backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-lg:min-h-11"
                >
                  <Icon size={20} className="shrink-0 text-white" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white">
                      {tile.label}
                    </span>
                    <span className="block truncate text-xs text-white/80">
                      {tile.hint}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------- users + activity */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h3 className="text-2xl font-bold text-ink">
              {tt("All User", "ผู้ใช้งานทั้งหมด")}{" "}
              <span className="text-base font-medium text-muted">
                ({counts.headcount})
              </span>
            </h3>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("admin.searchEmployee")}
              className="w-full sm:w-64"
            />
          </div>
          <TableWrap>
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-y border-line/70 bg-white">
                  <Th>{t("label.employee")}</Th>
                  <Th className="w-48">{tt("Phase Status", "สถานะความคืบหน้า")}</Th>
                  <Th>{tt("Skill Index", "ดัชนีสมรรถนะ")}</Th>
                  <Th>{t("label.department")}</Th>
                  <Th className="text-right">{t("label.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="size-8 shrink-0 rounded-full bg-line-2/60" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{p.name}</span>
                          <span className="block truncate text-[10px] text-muted">
                            {p.jobRoleName}
                            {p.positionName ? ` · ${p.positionName}` : ""}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <Progress
                        value={p.phase}
                        showLabel
                        tone={p.phase >= 100 ? "success" : "brand"}
                      />
                    </Td>
                    <Td className="font-bold">
                      {p.skillIndex ? p.skillIndex.toFixed(2) : "—"}
                    </Td>
                    <Td className="text-muted">{p.departmentName ?? "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <IconAction
                          aria-label={`${tt("Open", "เปิด")} ${p.name}`}
                          onClick={() => setDetail(p)}
                        >
                          <ChevronRight size={15} />
                        </IconAction>
                        {canRemind ? (
                          <IconAction
                            tone="brand"
                            disabled={busy || p.selfSubmitted}
                            aria-label={`${t("action.sendReminder")} — ${p.name}`}
                            onClick={() => remind(p)}
                          >
                            <Mail size={15} />
                          </IconAction>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="py-8 text-center text-muted">
                      {t("admin.noMatch")}
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
          {canExport ? (
            <div className="flex justify-center border-t border-line/70 p-5">
              <button
                type="button"
                onClick={exportOrg}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-surface disabled:opacity-45 max-lg:min-h-11"
              >
                <Download size={14} className="text-brand" />
                {tt(
                  "Comprehensive ORG Skills Export (.CSV)",
                  "ส่งออกข้อมูลสมรรถนะทั้งองค์กร (.CSV)",
                )}
              </button>
            </div>
          ) : null}
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-brand" />
            <h3 className="text-base font-bold text-ink">
              {tt("LIVE Activity", "กิจกรรมล่าสุด")}
            </h3>
          </div>
          <ul className="mt-4 space-y-3">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                  <ClipboardList size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-ink">
                    {entry.actorLabel}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {entry.action}
                    {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-muted">
                  {formatDateTime(entry.createdAt).slice(0, 10)}
                </span>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="py-6 text-center text-xs text-muted">
                {tt("No activity yet", "ยังไม่มีกิจกรรม")}
              </li>
            ) : null}
          </ul>
          <Link
            href="/admin/audit"
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
          >
            {t("action.seeAll")}
            <ChevronRight size={13} />
          </Link>
        </Card>
      </div>

      {/* --------------------------------------------- department details */}
      <Card className="mt-5">
        <CardHeader
          title={
            <span className="text-2xl">
              {tt("Department Details", "รายละเอียดฝ่าย")}
            </span>
          }
          subtitle={tt(
            "“Assessed” counts people whose whole competency set has a score this cycle.",
            "“ประเมินแล้ว” นับพนักงานที่มีคะแนนครบทุกสมรรถนะในรอบนี้",
          )}
        />
        <TableWrap>
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-y border-line/70">
                <Th>{t("label.department")}</Th>
                <Th>{t("label.employee")}</Th>
                <Th>{tt("Assessed", "ประเมินแล้ว")}</Th>
                <Th className="w-56">{t("label.progress")} (%)</Th>
                <Th className="text-right">{t("label.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-line/60 last:border-0">
                  <Td className="font-bold">{d.name}</Td>
                  <Td className="font-bold">{formatNumber(d.headcount)}</Td>
                  <Td className="font-bold">
                    {d.assessed}/{d.headcount}
                  </Td>
                  <Td>
                    <Progress
                      value={d.progress}
                      showLabel
                      tone={d.progress >= 100 ? "success" : "brand"}
                    />
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Pill
                        tone={
                          d.status === "complete"
                            ? "success"
                            : d.status === "on-track"
                              ? "brand"
                              : "danger"
                        }
                      >
                        {statusLabel(d.status)}
                      </Pill>
                    </div>
                  </Td>
                </tr>
              ))}
              {departments.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted">
                    {tt("No departments yet.", "ยังไม่มีฝ่ายในระบบ")}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* --------------------------------------------------------- modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={
          detail
            ? `${detail.positionName ?? detail.jobRoleName} · ${detail.level}`
            : undefined
        }
      >
        {detail ? (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {(
              [
                [t("label.employeeId"), detail.employeeCode],
                [t("label.nickname"), detail.nickname ?? "—"],
                [t("label.email"), detail.email],
                [t("label.role"), detail.jobRoleName],
                [t("label.grade"), detail.grade ?? "—"],
                [t("label.businessUnit"), detail.businessUnit ?? "—"],
                [t("label.department"), detail.departmentName ?? "—"],
                [t("label.division"), detail.divisionName ?? "—"],
                [t("label.reportTo"), detail.managerName ?? "—"],
                [
                  tt("Skill index", "ดัชนีสมรรถนะ"),
                  detail.skillIndex ? detail.skillIndex.toFixed(2) : "—",
                ],
                [
                  tt("Assessment phase", "ความคืบหน้าการประเมิน"),
                  tt(
                    `${detail.phase}% of ${detail.assessedCount} competencies`,
                    `${detail.phase}% จาก ${detail.assessedCount} สมรรถนะ`,
                  ),
                ],
                [t("label.points"), formatNumber(detail.points)],
                [
                  tt("Submitted", "การส่ง"),
                  [
                    detail.selfSubmitted ? t("mode.self") : null,
                    detail.supervisorSubmitted ? t("mode.supervisor") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || tt("Nothing yet", "ยังไม่ส่ง"),
                ],
                [t("label.remark"), detail.remark || "—"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] uppercase tracking-wide text-muted">{k}</p>
                <p className="text-sm font-medium text-ink">{v}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
