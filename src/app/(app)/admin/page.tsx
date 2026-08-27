"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  Download,
  Gift,
  Mail,
  Radio,
  ClipboardList,
  Trophy,
} from "lucide-react";
import { Card, CardHeader, Modal, PageHeading, Pill, Progress } from "@/components/ui";
import { Donut, DonutLegend, type DonutSlice } from "@/components/charts";
import {
  AdminOnly,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
  formatDateTime,
} from "@/components/admin/shared";
import { findPerson, type Person } from "@/data/people";
import { useDemo } from "@/lib/store";
import { currentCycle, cycleMilestones, formatDay } from "@/data/cycle";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

export default function AdminOverviewPage() {
  return (
    <AdminOnly>
      <AdminOverview />
    </AdminOnly>
  );
}

/* --------------------------------------------------------------- cycle */

const CYCLE = currentCycle();
const MILESTONES = cycleMilestones(CYCLE);
const CURRENT_STOP = Math.max(
  0,
  MILESTONES.map((m) => m.passed).lastIndexOf(true),
);
const DONUT_COLORS = ["#faa21b", "#006bff", "#f05123", "#00b916"];

function AdminOverview() {
  const { state, notify, pushNotification, logActivity } = useDemo();
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Person | null>(null);

  const employees = state.employees;

  const STOPS = MILESTONES.map(
    (m) => `${tt(m.en, m.th)} (${formatDay(m.date, lang)})`,
  );

  const MANAGEMENT_TILES = [
    {
      href: "/admin/assessment",
      label: t("nav.assessment"),
      hint: tt("Manage evaluations", "จัดการการประเมิน"),
      icon: ClipboardList,
    },
    {
      href: "/admin/lms",
      label: t("nav.lms"),
      hint: tt("Manage courses", "จัดการหลักสูตร"),
      icon: BookOpen,
    },
    {
      href: "/admin/achievements",
      label: t("nav.achievements"),
      hint: tt("Manage badges", "จัดการเหรียญรางวัล"),
      icon: Trophy,
    },
    {
      href: "/admin/reward",
      label: t("nav.reward"),
      hint: tt("Manage prizes", "จัดการของรางวัล"),
      icon: Gift,
    },
  ];

  /** `reportTo` / activity actors are person ids; "-" and "system" are not. */
  const nameOf = (id: string) => {
    if (!id || id === "-") return "—";
    if (id === "system") return tt("System", "ระบบ");
    const found = findPerson(id);
    return found.id === id ? found.name : id;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((p) =>
      [p.name, p.position, p.jobRole, p.department, p.employeeId].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [employees, query]);

  /* headcount comes out of the live employee list, not a hand-written figure */
  const departments = useMemo(() => {
    const map = new Map<string, Person[]>();
    employees.forEach((p) => {
      map.set(p.department, [...(map.get(p.department) ?? []), p]);
    });
    return [...map.entries()].map(([name, members], i) => {
      const done = members.filter((m) => m.phase >= 100).length;
      const progress = Math.round(
        members.reduce((a, m) => a + m.phase, 0) / Math.max(members.length, 1),
      );
      return {
        id: `d${i + 1}`,
        name,
        members,
        employees: members.length,
        assessed: `${done}/${members.length}`,
        progress,
        status:
          progress >= 100 ? "Complete" : progress >= 60 ? "On Track" : "Needs Follow-Up",
      };
    });
  }, [employees]);

  const statusLabel = (s: string) =>
    s === "Complete"
      ? t("label.complete")
      : s === "On Track"
        ? t("status.onTrack")
        : t("status.needsFollowUp");

  const slices: DonutSlice[] = departments.map((d, i) => ({
    name: d.name,
    value: d.employees,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));
  const totalStaff = employees.length;

  /* live cycle counters, read from the store rather than hard-coded */
  const selfSubmitted = employees.filter(
    (p) => state.selfAssessment[p.id]?.submittedAt,
  ).length;
  const reviewSubmitted = employees.filter((p) =>
    Object.entries(state.managerReview).some(
      ([k, v]) => k.endsWith(`:${p.id}`) && v.submittedAt,
    ),
  ).length;

  const feed = state.activityLog.slice(0, 6);

  function exportOrg() {
    downloadCsv(
      "1moby-org-skills-export.csv",
      [
        t("label.employeeId"),
        t("label.employee"),
        t("label.position"),
        t("label.role"),
        t("label.level"),
        t("label.businessUnit"),
        t("label.department"),
        t("label.division"),
        t("label.reportTo"),
        tt("Skill Index", "ดัชนีสมรรถนะ"),
        tt("Phase %", "ความคืบหน้า %"),
        t("label.points"),
      ],
      employees.map((p) => [
        p.employeeId,
        p.name,
        p.position,
        p.jobRole,
        p.level,
        p.businessUnit,
        p.department,
        p.division,
        nameOf(p.reportTo),
        p.skillIndex,
        p.phase,
        state.points[p.id] ?? p.points,
      ]),
    );
    logActivity("Exported org skills report", `${employees.length} employees`);
    notify(
      tt(
        `Exported ${employees.length} employees as CSV`,
        `ส่งออกข้อมูลพนักงาน ${employees.length} คนเป็น CSV แล้ว`,
      ),
    );
  }

  function remind(p: Person) {
    pushNotification({
      audience: p.id,
      title: tt("Assessment reminder", "แจ้งเตือนการประเมิน"),
      body: tt(
        "Your assessment cycle is still open — please finish it before the deadline.",
        "รอบการประเมินของคุณยังเปิดอยู่ กรุณาทำให้เสร็จก่อนกำหนด",
      ),
      kind: "assessment",
      channel: "Both",
      href: "/assessment",
    });
    logActivity("Sent assessment reminder", p.name);
    notify(tt(`Reminder sent to ${p.name}`, `ส่งการแจ้งเตือนถึง ${p.name} แล้ว`));
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={tt("Admin Overview", "ภาพรวมผู้ดูแลระบบ")} />

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
                  {tt(
                    `${CYCLE.nameEn} ASSESSMENT CYCLE MONITORING`,
                    `การติดตามรอบการประเมิน${CYCLE.nameTh}`,
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  {tt(`ACTIVE: ${CYCLE.rangeEn}`, `เปิดใช้: ${CYCLE.rangeTh}`)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-ink">
                {tt("Time Remaining", "เวลาที่เหลือ")}
              </p>
              <p className="text-xl font-bold text-brand">
                {tt(
                  `${CYCLE.daysRemaining} Days`,
                  `${CYCLE.daysRemaining} วัน`,
                )}
              </p>
            </div>
          </div>

          {/* timeline */}
          <div className="relative mt-8 px-1">
            <div className="absolute inset-x-2 top-[5px] h-0.5 rounded-full bg-surface" />
            <div
              className="absolute left-2 top-[5px] h-0.5 rounded-full bg-brand"
              style={{
                width: `calc((100% - 1rem) * ${CURRENT_STOP / (STOPS.length - 1)})`,
              }}
            />
            <div className="relative flex justify-between">
              {STOPS.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    "flex flex-col gap-2",
                    i === 0 && "items-start",
                    i === STOPS.length - 1 && "items-end",
                    i > 0 && i < STOPS.length - 1 && "items-center",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full border-2 bg-white",
                      i <= CURRENT_STOP ? "border-brand" : "border-line-2",
                      i === CURRENT_STOP && "bg-brand",
                    )}
                  />
                  <span
                    className={cn(
                      "whitespace-nowrap text-[11px] font-bold",
                      i === CURRENT_STOP ? "text-brand" : "text-muted",
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* mini stats */}
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: tt("Submissions", "การส่งประเมิน"),
                value: `${selfSubmitted} / ${totalStaff}`,
                tone: "text-brand",
              },
              {
                label: t("mode.supervisor"),
                value: `${reviewSubmitted} / ${totalStaff}`,
                tone: "text-amber",
              },
              {
                label: tt("LMS Certificates", "ใบรับรองจากระบบเรียนรู้"),
                value: `${state.certificates.length}`,
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
              total={totalStaff}
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
            "Centralized system management for all modules",
            "จัดการทุกโมดูลของระบบจากที่เดียว",
          )}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MANAGEMENT_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.href}
                type="button"
                onClick={() => router.push(tile.href)}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/15 px-4 py-4 text-left backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------- users + activity */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h3 className="text-2xl font-bold text-ink">
              {tt("All User", "ผู้ใช้งานทั้งหมด")}{" "}
              <span className="text-base font-medium text-muted">
                ({totalStaff})
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
                            {p.jobRole} · {p.position}
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
                    <Td className="font-bold">{p.skillIndex.toFixed(2)}</Td>
                    <Td className="text-muted">{p.department}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <IconAction
                          aria-label={`${tt("Open", "เปิด")} ${p.name}`}
                          onClick={() => setDetail(p)}
                        >
                          <ChevronRight size={15} />
                        </IconAction>
                        <IconAction
                          tone="brand"
                          aria-label={`${t("action.sendReminder")} — ${p.name}`}
                          onClick={() => remind(p)}
                        >
                          <Mail size={15} />
                        </IconAction>
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
          <div className="flex justify-center border-t border-line/70 p-5">
            <button
              type="button"
              onClick={exportOrg}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-surface"
            >
              <Download size={14} className="text-brand" />
              {tt(
                "Comprehensive ORG Skills Export (.CSV)",
                "ส่งออกข้อมูลสมรรถนะทั้งองค์กร (.CSV)",
              )}
            </button>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-brand" />
            <h3 className="text-base font-bold text-ink">
              {tt("LIVE Activity", "กิจกรรมล่าสุด")}
            </h3>
          </div>
          <ul className="mt-4 space-y-3">
            {feed.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                  <ClipboardList size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-ink">
                    {nameOf(entry.actor)}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {entry.action} · {entry.target}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-muted">
                  {formatDateTime(entry.at).slice(0, 10)}
                </span>
              </li>
            ))}
            {feed.length === 0 ? (
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
                  <Td className="font-bold">{formatNumber(d.employees)}</Td>
                  <Td className="font-bold">{d.assessed}</Td>
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
                          d.status === "Complete"
                            ? "success"
                            : d.status === "On Track"
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
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* --------------------------------------------------------- modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.position} · ${detail.level}` : undefined}
      >
        {detail ? (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              [t("label.employeeId"), detail.employeeId],
              [t("label.nickname"), detail.nickname],
              [t("label.email"), detail.email],
              [t("label.role"), detail.jobRole],
              [t("label.grade"), detail.grade],
              [t("label.businessUnit"), detail.businessUnit],
              [t("label.department"), detail.department],
              [t("label.division"), detail.division],
              [t("label.reportTo"), nameOf(detail.reportTo)],
              [tt("Skill index", "ดัชนีสมรรถนะ"), detail.skillIndex.toFixed(2)],
              [tt("Assessment phase", "ความคืบหน้าการประเมิน"), `${detail.phase}%`],
              [
                t("label.points"),
                formatNumber(state.points[detail.id] ?? detail.points),
              ],
              [t("label.remark"), detail.remark || "—"],
            ].map(([k, v]) => (
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
