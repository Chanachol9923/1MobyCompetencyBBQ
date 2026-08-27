"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Users } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeading,
  Pill,
  Select,
  Tabs,
} from "@/components/ui";
import {
  VerdictPill,
  VERDICT_DOT,
  useVerdictLabel,
} from "@/components/profile/VerdictPill";
import {
  aggregateGaps,
  formatGap,
  personSummaries,
  verdictCounts,
  type AggRow,
} from "@/components/profile/gap";
import { GROUP_LABEL, GROUP_LABEL_TH } from "@/data/competencies";
import type { GapVerdict } from "@/data/competencies";
import {
  DEPARTMENTS,
  DIVISIONS,
  STAFF,
  directReportsOf,
  type Person,
} from "@/data/people";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { initials } from "@/lib/utils";
import { GapBarChart, toBarData } from "./GapBarChart";
import { downloadCsv } from "./csv";

type Scope = "me" | "team" | "company";
type SortKey = "competency" | "avgManager" | "avgExpected" | "gap" | "belowCount";

const ALL = "__all__";

const VERDICT_ORDER: GapVerdict[] = [
  "strength",
  "standard",
  "development",
  "critical",
];

export default function ReportsPage() {
  const { state, person, notify, logActivity } = useDemo();
  const { t, tt, lang } = useT();
  const router = useRouter();
  const verdictLabel = useVerdictLabel();

  const role = state.role;
  const reports = useMemo(
    () => (person ? directReportsOf(person.id) : []),
    [person],
  );

  /** l1 sees only itself, l2 adds its team, admin gets the company. */
  const scopes = useMemo<Scope[]>(() => {
    if (role === "admin") return ["company"];
    if (role === "l2") return reports.length ? ["me", "team"] : ["me"];
    return ["me"];
  }, [role, reports.length]);

  const [scope, setScope] = useState<Scope>("me");
  const activeScope = scopes.includes(scope) ? scope : scopes[0]!;

  const [department, setDepartment] = useState(ALL);
  const [division, setDivision] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [sortAsc, setSortAsc] = useState(true);

  const divisionChoices = useMemo(
    () =>
      DIVISIONS.filter((d) => department === ALL || d.department === department),
    [department],
  );

  /* ----------------------------------------------------- people in scope */
  const people = useMemo<Person[]>(() => {
    if (activeScope === "me") return person ? [person] : [];
    if (activeScope === "team") return reports;
    return STAFF.filter(
      (p) =>
        (department === ALL || p.department === department) &&
        (division === ALL || p.division === division),
    );
  }, [activeScope, person, reports, department, division]);

  const rows = useMemo(() => aggregateGaps(state, people), [state, people]);
  const counts = useMemo(() => verdictCounts(rows), [rows]);
  const summaries = useMemo(
    () => personSummaries(state, people),
    [state, people],
  );

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "competency") {
        return a.competency.name.localeCompare(b.competency.name) * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [rows, sortKey, sortAsc]);

  const byGapDesc = useMemo(
    () => [...rows].sort((a, b) => b.gap - a.gap),
    [rows],
  );
  const strongest = byGapDesc.slice(0, 3);
  const weakest = [...byGapDesc].reverse().slice(0, 3);

  const headcount = people.length;
  const avgScore = rows.length
    ? Number(
        (rows.reduce((a, r) => a + r.avgManager, 0) / rows.length).toFixed(2),
      )
    : 0;
  const avgExpected = rows.length
    ? Number(
        (rows.reduce((a, r) => a + r.avgExpected, 0) / rows.length).toFixed(2),
      )
    : 0;
  const belowTotal = rows.reduce((a, r) => a + r.belowCount, 0);

  const scopeLabel = (s: Scope) =>
    s === "me"
      ? tt("Me", "ของฉัน")
      : s === "team"
        ? tt("My team", "ทีมของฉัน")
        : tt("Company", "ทั้งบริษัท");

  const scopeCaption =
    activeScope === "company" && (department !== ALL || division !== ALL)
      ? [department === ALL ? null : department, division === ALL ? null : division]
          .filter(Boolean)
          .join(" · ")
      : scopeLabel(activeScope);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v);
      return;
    }
    setSortKey(key);
    setSortAsc(key === "gap" || key === "competency");
  };

  /* ------------------------------------------------------------- export */
  const exportCsv = () => {
    if (!rows.length) {
      notify(tt("Nothing to export in this scope", "ไม่มีข้อมูลให้ส่งออกในขอบเขตนี้"));
      return;
    }
    const data: (string | number)[][] = [
      [tt("Gap Analysis Report", "รายงานวิเคราะห์ช่องว่างสมรรถนะ")],
      [tt("Scope", "ขอบเขต"), scopeCaption],
      [tt("Headcount", "จำนวนพนักงาน"), headcount],
      [tt("Generated", "สร้างเมื่อ"), new Date().toISOString().slice(0, 10)],
      [],
      [
        tt("Competency", "สมรรถนะ"),
        tt("Group", "กลุ่ม"),
        tt("Avg self", "คะแนนประเมินตนเองเฉลี่ย"),
        tt("Avg manager score", "คะแนนหัวหน้าประเมินเฉลี่ย"),
        t("label.expected"),
        t("label.gap"),
        tt("Verdict", "ผลการวิเคราะห์"),
        tt("Below expectation", "ต่ำกว่าเกณฑ์"),
        tt("Assessed", "จำนวนที่ประเมิน"),
      ],
      ...sorted.map((r) => [
        r.competency.name,
        lang === "th"
          ? GROUP_LABEL_TH[r.competency.group]
          : GROUP_LABEL[r.competency.group],
        r.avgSelf,
        r.avgManager,
        r.avgExpected,
        formatGap(r.gap),
        verdictLabel(r.verdict),
        r.belowCount,
        r.assessedCount,
      ]),
    ];

    if (people.length > 1) {
      data.push([], [tt("Per employee", "รายบุคคล")]);
      data.push([
        tt("Employee", "พนักงาน"),
        t("label.position"),
        tt("Job role", "ระดับตำแหน่ง"),
        t("label.department"),
        tt("Avg gap", "ส่วนต่างเฉลี่ย"),
        tt("Critical competencies", "สมรรถนะที่ต้องพัฒนาเร่งด่วน"),
        tt("Strongest", "จุดแข็งที่สุด"),
        tt("Weakest", "จุดอ่อนที่สุด"),
      ]);
      summaries.forEach((s) =>
        data.push([
          s.person.name,
          s.person.position,
          s.person.jobRole,
          s.person.department,
          formatGap(s.avgGap),
          s.criticalCount,
          s.best ? `${s.best.competency.name} (${formatGap(s.best.gap)})` : "-",
          s.worst
            ? `${s.worst.competency.name} (${formatGap(s.worst.gap)})`
            : "-",
        ]),
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`gap-analysis-${activeScope}-${stamp}.csv`, data);
    logActivity(
      "Exported gap analysis report",
      scopeCaption,
      `${rows.length} competencies · ${headcount} people`,
    );
    notify(tt("CSV downloaded", "ดาวน์โหลดไฟล์ CSV แล้ว"));
  };

  if (!person || !role) return null;

  const tileTone: Record<GapVerdict, string> = {
    strength: "text-success",
    standard: "text-brand",
    development: "text-amber",
    critical: "text-accent",
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Gap Analysis Report", "รายงานวิเคราะห์ช่องว่างสมรรถนะ")}
        subtitle={tt(
          "Manager score against the expected level from the competency map",
          "คะแนนจากหัวหน้าเทียบกับระดับที่คาดหวังตามผังสมรรถนะ",
        )}
        right={
          <Button onClick={exportCsv}>
            <Download size={16} /> {t("action.export")}
          </Button>
        }
      />

      {/* --------------------------------------------------- scope switcher */}
      <div className="flex flex-wrap items-center gap-3">
        {scopes.length > 1 ? (
          <Tabs
            value={activeScope}
            onChange={(v: Scope) => setScope(v)}
            options={scopes.map((s) => ({ value: s, label: scopeLabel(s) }))}
          />
        ) : (
          <Pill tone="brand">{scopeLabel(activeScope)}</Pill>
        )}

        <Pill tone="neutral">
          <Users size={13} className="mr-1.5" />
          {headcount}{" "}
          {headcount === 1 ? tt("person", "คน") : tt("people", "คน")}
        </Pill>

        {activeScope === "company" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="h-9 w-auto py-1.5 text-xs"
              value={department}
              aria-label={t("label.department")}
              onChange={(e) => {
                setDepartment(e.target.value);
                setDivision(ALL);
              }}
            >
              <option value={ALL}>
                {tt("All departments", "ทุกฝ่าย")}
              </option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.employees})
                </option>
              ))}
            </Select>
            <Select
              className="h-9 w-auto py-1.5 text-xs"
              value={division}
              aria-label={t("label.division")}
              onChange={(e) => setDivision(e.target.value)}
            >
              <option value={ALL}>{tt("All divisions", "ทุกแผนก")}</option>
              {divisionChoices.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
            {department !== ALL || division !== ALL ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDepartment(ALL);
                  setDivision(ALL);
                }}
              >
                {tt("Clear filter", "ล้างตัวกรอง")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title={tt("No assessed competencies in scope", "ไม่มีสมรรถนะที่ประเมินในขอบเขตนี้")}
            hint={tt(
              "Change the filter or pick another scope.",
              "เปลี่ยนตัวกรองหรือเลือกขอบเขตอื่น",
            )}
          />
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------ summary tiles */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERDICT_ORDER.map((v) => (
              <Card key={v} className="p-5">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${VERDICT_DOT[v]}`} />
                  <p className="text-xs text-muted">{verdictLabel(v)}</p>
                </div>
                <p className={`mt-1 text-3xl font-bold ${tileTone[v]}`}>
                  {counts[v]}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {tt("of", "จาก")} {rows.length}{" "}
                  {tt("competencies", "สมรรถนะ")}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted">
                {tt("Average score", "คะแนนเฉลี่ย")}
              </p>
              <p className="mt-0.5 text-xl font-bold text-ink">
                {avgScore.toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">{t("label.expected")}</p>
              <p className="mt-0.5 text-xl font-bold text-muted">
                {avgExpected.toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">
                {tt("Ratings below expectation", "รายการที่ต่ำกว่าเกณฑ์")}
              </p>
              <p className="mt-0.5 text-xl font-bold text-accent">
                {belowTotal}
              </p>
            </Card>
          </div>

          {/* ------------------------------------------------------ bar chart */}
          <Card className="mt-6">
            <CardHeader
              title={tt(
                "Average score vs expected level",
                "คะแนนเฉลี่ยเทียบกับระดับที่คาดหวัง",
              )}
              subtitle={scopeCaption}
            />
            <div className="scroll-thin min-w-0 overflow-x-auto px-2 pb-5">
              <GapBarChart
                data={toBarData(byGapDesc)}
                actualLabel={tt("Avg manager score", "คะแนนหัวหน้าประเมินเฉลี่ย")}
                expectedLabel={t("label.expected")}
                verdictKeyLabel={tt("Score bar colour:", "สีของหลอดคะแนน:")}
              />
            </div>
          </Card>

          {/* ------------------------------------------- strengths / shortfalls */}
          <Card className="mt-6">
            <CardHeader
              title={tt(
                "Team strengths and shortfalls",
                "จุดแข็งและจุดที่ต้องพัฒนาของทีม",
              )}
              subtitle={tt(
                "Generated from the manager scores in this scope",
                "สรุปจากคะแนนที่หัวหน้าประเมินในขอบเขตนี้",
              )}
            />
            <div className="px-5 pb-5">
              <p className="rounded-lg bg-brand-tint px-4 py-3 text-sm leading-relaxed text-ink">
                {narrative({ tt, strongest, weakest, headcount, activeScope })}
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ReadPanel
                  title={tt("Strongest at", "ทำได้ดีที่สุด")}
                  rows={strongest}
                  tone="success"
                  emptyText={tt("No data", "ไม่มีข้อมูล")}
                  renderMeta={(r) =>
                    r.topPerson
                      ? `${tt("top", "สูงสุด")}: ${r.topPerson.nickname || r.topPerson.name} (${r.topScore})`
                      : ""
                  }
                />
                <ReadPanel
                  title={tt("Short on", "ยังขาดมากที่สุด")}
                  rows={weakest}
                  tone="danger"
                  emptyText={tt("No data", "ไม่มีข้อมูล")}
                  renderMeta={(r) =>
                    `${r.belowCount}/${r.assessedCount} ${tt("below expectation", "ต่ำกว่าเกณฑ์")}`
                  }
                />
              </div>

              {people.length > 1 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    {tt("Who needs attention first", "ใครควรได้รับการดูแลก่อน")}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {[...summaries]
                      .sort((a, b) => a.avgGap - b.avgGap)
                      .slice(0, 4)
                      .map((s) => (
                        <li
                          key={s.person.id}
                          className="flex items-center gap-2 rounded-lg border border-line/70 px-3 py-2"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/60 text-[11px] font-bold text-white">
                            {initials(s.person.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-ink">
                              {s.person.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {s.worst
                                ? `${tt("weakest", "จุดอ่อน")}: ${s.worst.competency.name} ${formatGap(s.worst.gap)}`
                                : s.person.position}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-xs font-bold tabular-nums ${
                              s.avgGap < 0 ? "text-accent" : "text-success"
                            }`}
                          >
                            {formatGap(s.avgGap)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          {/* ------------------------------------------------------ gap table */}
          <Card className="mt-6">
            <CardHeader
              title={tt("Gap table", "ตารางวิเคราะห์ช่องว่าง")}
              subtitle={tt(
                "Click a column header to sort — biggest gap first by default",
                "คลิกหัวตารางเพื่อจัดเรียง — ค่าเริ่มต้นคือช่องว่างมากที่สุดก่อน",
              )}
            />
            <div className="scroll-thin overflow-x-auto px-4 pb-5">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <SortTh
                      label={tt("Competency", "สมรรถนะ")}
                      active={sortKey === "competency"}
                      asc={sortAsc}
                      onClick={() => toggleSort("competency")}
                    />
                    <SortTh
                      label={tt("Avg score", "คะแนนเฉลี่ย")}
                      active={sortKey === "avgManager"}
                      asc={sortAsc}
                      align="center"
                      onClick={() => toggleSort("avgManager")}
                    />
                    <SortTh
                      label={t("label.expected")}
                      active={sortKey === "avgExpected"}
                      asc={sortAsc}
                      align="center"
                      onClick={() => toggleSort("avgExpected")}
                    />
                    <SortTh
                      label={t("label.gap")}
                      active={sortKey === "gap"}
                      asc={sortAsc}
                      align="center"
                      onClick={() => toggleSort("gap")}
                    />
                    <th className="px-3 py-3 font-normal">
                      {tt("Verdict", "ผลการวิเคราะห์")}
                    </th>
                    <SortTh
                      label={tt("Below expectation", "ต่ำกว่าเกณฑ์")}
                      active={sortKey === "belowCount"}
                      asc={sortAsc}
                      align="center"
                      onClick={() => toggleSort("belowCount")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.competency.id} className="border-b border-line/60">
                      <td className="px-3 py-3">
                        <span className="block text-[13px] font-bold text-ink">
                          {r.competency.name}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {lang === "th"
                            ? GROUP_LABEL_TH[r.competency.group]
                            : GROUP_LABEL[r.competency.group]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="block font-bold text-ink tabular-nums">
                          {r.avgManager.toFixed(2)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {t("mode.self")} {r.avgSelf.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-muted tabular-nums">
                        {r.avgExpected.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-3 text-center font-bold tabular-nums ${
                          r.gap < 0 ? "text-accent" : "text-success"
                        }`}
                      >
                        {formatGap(r.gap)}
                      </td>
                      <td className="px-3 py-3">
                        <VerdictPill verdict={r.verdict} />
                      </td>
                      <td className="px-3 py-3 text-center text-ink tabular-nums">
                        {r.belowCount}
                        <span className="text-muted">/{r.assessedCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          {tt("Back to dashboard", "กลับสู่แดชบอร์ด")}
        </Button>
        {role === "l2" ? (
          <Button variant="outline" onClick={() => router.push("/team-profile")}>
            {t("nav.teamProfile")}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => router.push("/idp")}>
          {tt("Open development plan", "เปิดแผนพัฒนา")}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

function SortTh({
  label,
  active,
  asc,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  align?: "left" | "center";
  onClick: () => void;
}) {
  return (
    <th className={`px-3 py-3 font-normal ${align === "center" ? "text-center" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
          active ? "font-bold text-ink" : ""
        }`}
      >
        {label}
        {active ? (
          asc ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : null}
      </button>
    </th>
  );
}

function ReadPanel({
  title,
  rows,
  tone,
  emptyText,
  renderMeta,
}: {
  title: string;
  rows: AggRow[];
  tone: "success" | "danger";
  emptyText: string;
  renderMeta: (r: AggRow) => string;
}) {
  return (
    <div className="rounded-lg border border-line/70 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.competency.id} className="flex items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${
                tone === "success" ? "bg-success" : "bg-accent"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">
                {r.competency.name}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {renderMeta(r)}
              </span>
            </span>
            <span
              className={`shrink-0 text-xs font-bold tabular-nums ${
                tone === "success" ? "text-success" : "text-accent"
              }`}
            >
              {formatGap(r.gap)}
            </span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-4 text-center text-xs text-muted">{emptyText}</li>
        ) : null}
      </ul>
    </div>
  );
}

/** The short generated read the requirement pack asks for. */
function narrative({
  tt,
  strongest,
  weakest,
  headcount,
  activeScope,
}: {
  tt: (en: string, th: string) => string;
  strongest: AggRow[];
  weakest: AggRow[];
  headcount: number;
  activeScope: Scope;
}) {
  const best = strongest[0];
  const worst = weakest[0];
  if (!best || !worst) return tt("Not enough data yet.", "ข้อมูลยังไม่เพียงพอ");

  const who =
    activeScope === "me"
      ? tt("You are", "คุณ")
      : activeScope === "team"
        ? tt("The team is", "ทีมนี้")
        : tt("The company is", "ทั้งบริษัท");

  const en =
    `${who} strongest at ${best.competency.name} ` +
    `(${best.avgManager.toFixed(2)} vs ${best.avgExpected.toFixed(2)} expected, ${formatGap(best.gap)}) ` +
    `and weakest at ${worst.competency.name} ` +
    `(${worst.avgManager.toFixed(2)} vs ${worst.avgExpected.toFixed(2)}, ${formatGap(worst.gap)})` +
    (headcount > 1
      ? `, where ${worst.belowCount} of ${worst.assessedCount} assessed people sit below expectation.`
      : ".");

  const th =
    `${who}ทำได้ดีที่สุดในสมรรถนะ ${best.competency.name} ` +
    `(${best.avgManager.toFixed(2)} เทียบกับเกณฑ์ ${best.avgExpected.toFixed(2)} · ${formatGap(best.gap)}) ` +
    `และอ่อนที่สุดในสมรรถนะ ${worst.competency.name} ` +
    `(${worst.avgManager.toFixed(2)} เทียบกับเกณฑ์ ${worst.avgExpected.toFixed(2)} · ${formatGap(worst.gap)})` +
    (headcount > 1
      ? ` โดยมี ${worst.belowCount} จาก ${worst.assessedCount} คนที่ต่ำกว่าเกณฑ์`
      : "");

  return tt(en, th);
}
