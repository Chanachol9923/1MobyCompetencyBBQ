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
  ResponsiveTable,
  Select,
  Tabs,
} from "@/components/ui";
import {
  VerdictPill,
  VERDICT_DOT,
  useVerdictLabel,
} from "@/components/profile/VerdictPill";
import {
  VERDICT_ORDER,
  formatGap,
  groupDictKey,
  nameOf,
  pick,
  verdictCounts,
  type AggRow,
  type GapVerdict,
  type ScopePerson,
} from "@/components/profile/gap";
import { useT } from "@/lib/i18n";
import { initials } from "@/lib/utils";
import { GapBarChart, toBarData } from "./GapBarChart";
import { downloadCsv } from "./csv";
import { recordExportAction } from "./actions";

export type Scope = "me" | "team" | "company";

type SortKey = "competency" | "avgScore" | "avgExpected" | "gap" | "belowCount";

const ALL = "__all__";

const tileTone: Record<GapVerdict, string> = {
  strength: "text-success",
  standard: "text-brand",
  development: "text-amber",
  critical: "text-accent",
};

export function ReportsView({
  scope,
  scopes,
  departments,
  divisions,
  departmentId,
  divisionId,
  headcount,
  rows,
  people,
  peopleTruncated,
  peopleLimit,
  canSeeTeam,
  canWorkIdp,
}: {
  scope: Scope;
  scopes: Scope[];
  departments: { id: string; name: string; employees: number }[];
  divisions: { id: string; name: string; departmentId: string }[];
  departmentId: string | null;
  divisionId: string | null;
  headcount: number;
  rows: AggRow[];
  people: ScopePerson[];
  peopleTruncated: boolean;
  peopleLimit: number;
  canSeeTeam: boolean;
  canWorkIdp: boolean;
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const verdictLabel = useVerdictLabel();

  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [sortAsc, setSortAsc] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  /** The scope and the filters live in the URL, so the server re-queries. */
  const go = (next: Partial<{ scope: Scope; dept: string; div: string }>) => {
    const query = new URLSearchParams();
    const s = next.scope ?? scope;
    query.set("scope", s);
    const dept = next.dept !== undefined ? next.dept : (departmentId ?? "");
    const div = next.div !== undefined ? next.div : (divisionId ?? "");
    if (s === "company" && dept) query.set("dept", dept);
    if (s === "company" && div) query.set("div", div);
    router.push(`/reports?${query.toString()}`);
  };

  const divisionChoices = divisions.filter(
    (d) => !departmentId || d.departmentId === departmentId,
  );

  const counts = useMemo(() => verdictCounts(rows), [rows]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "competency") {
        return nameOf(a, lang).localeCompare(nameOf(b, lang)) * dir;
      }
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [rows, sortKey, sortAsc, lang]);

  const byGapDesc = useMemo(() => [...rows].sort((a, b) => b.gap - a.gap), [rows]);
  const strongest = byGapDesc.slice(0, 3);
  const weakest = [...byGapDesc].reverse().slice(0, 3);

  const avgScore = rows.length
    ? Number((rows.reduce((a, r) => a + r.avgScore, 0) / rows.length).toFixed(2))
    : 0;
  const avgExpected = rows.length
    ? Number(
        (rows.reduce((a, r) => a + r.avgExpected, 0) / rows.length).toFixed(2),
      )
    : 0;
  const belowTotal = rows.reduce((a, r) => a + r.belowCount, 0);

  const departmentName =
    departments.find((d) => d.id === departmentId)?.name ?? null;
  const divisionName = divisions.find((d) => d.id === divisionId)?.name ?? null;

  const scopeLabel = (s: Scope) =>
    s === "me"
      ? tt("Me", "ของฉัน")
      : s === "team"
        ? tt("My team", "ทีมของฉัน")
        : tt("Company", "ทั้งบริษัท");

  const scopeCaption =
    scope === "company" && (departmentName || divisionName)
      ? [departmentName, divisionName].filter(Boolean).join(" · ")
      : scopeLabel(scope);

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
      setNotice(
        tt("Nothing to export in this scope", "ไม่มีข้อมูลให้ส่งออกในขอบเขตนี้"),
      );
      return;
    }
    const data: (string | number)[][] = [
      [tt("Gap analysis report", "รายงานวิเคราะห์ช่องว่างสมรรถนะ")],
      [tt("Scope", "ขอบเขต"), scopeCaption],
      [tt("Headcount", "จำนวนพนักงาน"), headcount],
      [tt("Generated", "สร้างเมื่อ"), new Date().toISOString().slice(0, 10)],
      [],
      [
        tt("Competency", "สมรรถนะ"),
        tt("Group", "กลุ่ม"),
        tt("Average self score", "คะแนนประเมินตนเองเฉลี่ย"),
        tt("Average manager score", "คะแนนหัวหน้าประเมินเฉลี่ย"),
        t("label.expected"),
        t("label.gap"),
        tt("Verdict", "ผลการวิเคราะห์"),
        tt("Below expectation", "ต่ำกว่าเกณฑ์"),
        tt("Assessed", "จำนวนที่ประเมิน"),
      ],
      ...sorted.map((r) => [
        nameOf(r, lang),
        t(groupDictKey(r.group)),
        r.avgSelf,
        r.avgScore,
        r.avgExpected,
        formatGap(r.gap),
        verdictLabel(r.verdict),
        r.belowCount,
        r.assessedCount,
      ]),
    ];

    if (people.length > 1) {
      data.push([], [tt("Per employee", "รายบุคคล")]);
      if (peopleTruncated) {
        data.push([
          tt(
            `Showing the ${peopleLimit} people with the largest average gap.`,
            `แสดง ${peopleLimit} คนที่มีส่วนต่างเฉลี่ยมากที่สุด`,
          ),
        ]);
      }
      data.push([
        tt("Employee", "พนักงาน"),
        t("label.position"),
        tt("Career role", "บทบาทสายอาชีพ"),
        t("label.department"),
        tt("Average gap", "ส่วนต่างเฉลี่ย"),
        tt("Critical competencies", "สมรรถนะที่ต้องพัฒนาเร่งด่วน"),
        tt("Weakest", "จุดอ่อนที่สุด"),
      ]);
      people.forEach((p) =>
        data.push([
          p.name,
          p.position ?? "-",
          p.jobRole,
          p.department ?? "-",
          formatGap(p.avgGap),
          p.criticalCount,
          p.worstNameEn
            ? `${pick(lang, p.worstNameEn, p.worstNameTh)} (${formatGap(p.worstGap ?? 0)})`
            : "-",
        ]),
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`gap-analysis-${scope}-${stamp}.csv`, data);
    setNotice(tt("CSV downloaded", "ดาวน์โหลดไฟล์ CSV แล้ว"));
    void recordExportAction({
      scope,
      caption: scopeCaption,
      detail: `${rows.length} competencies · ${headcount} people`,
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Gap analysis report", "รายงานวิเคราะห์ช่องว่างสมรรถนะ")}
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
            value={scope}
            onChange={(v: Scope) => go({ scope: v })}
            options={scopes.map((s) => ({ value: s, label: scopeLabel(s) }))}
          />
        ) : (
          <Pill tone="brand">{scopeLabel(scope)}</Pill>
        )}

        <Pill tone="neutral">
          <Users size={13} className="mr-1.5" />
          {headcount}{" "}
          {headcount === 1 ? tt("person", "คน") : tt("people", "คน")}
        </Pill>

        {scope === "company" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="h-9 w-auto py-1.5 text-xs"
              value={departmentId ?? ALL}
              aria-label={t("label.department")}
              onChange={(e) =>
                go({
                  dept: e.target.value === ALL ? "" : e.target.value,
                  div: "",
                })
              }
            >
              <option value={ALL}>{tt("All departments", "ทุกฝ่าย")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.employees})
                </option>
              ))}
            </Select>
            <Select
              className="h-9 w-auto py-1.5 text-xs"
              value={divisionId ?? ALL}
              aria-label={t("label.division")}
              onChange={(e) =>
                go({ div: e.target.value === ALL ? "" : e.target.value })
              }
            >
              <option value={ALL}>{tt("All divisions", "ทุกแผนก")}</option>
              {divisionChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            {departmentId || divisionId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => go({ dept: "", div: "" })}
              >
                {tt("Clear filter", "ล้างตัวกรอง")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-3 text-xs font-medium text-brand" role="status">
          {notice}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title={tt(
              "No assessed competencies in scope",
              "ไม่มีสมรรถนะที่ประเมินในขอบเขตนี้",
            )}
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
                data={toBarData(byGapDesc, lang)}
                actualLabel={tt("Average manager score", "คะแนนหัวหน้าประเมินเฉลี่ย")}
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
                <Narrative
                  strongest={strongest}
                  weakest={weakest}
                  headcount={headcount}
                  scope={scope}
                />
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ReadPanel
                  title={tt("Strongest at", "ทำได้ดีที่สุด")}
                  rows={strongest}
                  tone="success"
                  emptyText={tt("No data", "ไม่มีข้อมูล")}
                  renderMeta={(r) =>
                    r.topName
                      ? `${tt("top", "สูงสุด")}: ${r.topName} (${r.topScore})`
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
                    {people.slice(0, 4).map((p) => (
                      <li
                        key={p.employeeId}
                        className="flex items-center gap-2 rounded-lg border border-line/70 px-3 py-2"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/60 text-[11px] font-bold text-white">
                          {initials(p.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-ink">
                            {p.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {p.worstNameEn
                              ? `${tt("weakest", "จุดอ่อน")}: ${pick(lang, p.worstNameEn, p.worstNameTh)} ${formatGap(p.worstGap ?? 0)}`
                              : (p.position ?? p.jobRole)}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-xs font-bold tabular-nums ${
                            p.avgGap < 0 ? "text-accent" : "text-success"
                          }`}
                        >
                          {formatGap(p.avgGap)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {peopleTruncated ? (
                    <p className="mt-2 text-[11px] text-muted">
                      {tt(
                        `Ranked across all ${headcount} people in scope; the ${peopleLimit} largest gaps are listed.`,
                        `จัดอันดับจากพนักงานทั้ง ${headcount} คนในขอบเขตนี้ และแสดง ${peopleLimit} รายที่มีส่วนต่างมากที่สุด`,
                      )}
                    </p>
                  ) : null}
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
            <ResponsiveTable className="px-4 pb-5" cardClassName="border-line">
              <table className="w-full min-w-[820px] xl:min-w-0 text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <SortTh
                      label={tt("Competency", "สมรรถนะ")}
                      active={sortKey === "competency"}
                      asc={sortAsc}
                      onClick={() => toggleSort("competency")}
                    />
                    <SortTh
                      label={tt("Average score", "คะแนนเฉลี่ย")}
                      active={sortKey === "avgScore"}
                      asc={sortAsc}
                      align="center"
                      onClick={() => toggleSort("avgScore")}
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
                    <tr key={r.competencyId} className="border-b border-line/60">
                      <td className="px-3 py-3">
                        <span className="block text-[13px] font-bold text-ink">
                          {nameOf(r, lang)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {t(groupDictKey(r.group))}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="block font-bold text-ink tabular-nums">
                          {r.avgScore.toFixed(2)}
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
            </ResponsiveTable>
          </Card>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {scopes.includes("me") ? (
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            {tt("Back to dashboard", "กลับสู่แดชบอร์ด")}
          </Button>
        ) : null}
        {canSeeTeam ? (
          <Button variant="outline" onClick={() => router.push("/team-profile")}>
            {t("nav.teamProfile")}
          </Button>
        ) : null}
        {canWorkIdp ? (
          <Button variant="outline" onClick={() => router.push("/idp")}>
            {tt("Open development plan", "เปิดแผนพัฒนา")}
          </Button>
        ) : null}
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
  const { lang } = useT();
  return (
    <div className="rounded-lg border border-line/70 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.competencyId} className="flex items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${
                tone === "success" ? "bg-success" : "bg-accent"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">
                {nameOf(r, lang)}
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
function Narrative({
  strongest,
  weakest,
  headcount,
  scope,
}: {
  strongest: AggRow[];
  weakest: AggRow[];
  headcount: number;
  scope: Scope;
}) {
  const { tt, lang } = useT();
  const best = strongest[0];
  const worst = weakest[0];
  if (!best || !worst) {
    return <>{tt("Not enough data yet.", "ข้อมูลยังไม่เพียงพอ")}</>;
  }

  const who =
    scope === "me"
      ? tt("You are", "คุณ")
      : scope === "team"
        ? tt("The team is", "ทีมนี้")
        : tt("The company is", "ทั้งบริษัท");

  const bestName = nameOf(best, lang);
  const worstName = nameOf(worst, lang);

  const en =
    `${who} strongest at ${bestName} ` +
    `(${best.avgScore.toFixed(2)} vs ${best.avgExpected.toFixed(2)} expected, ${formatGap(best.gap)}) ` +
    `and weakest at ${worstName} ` +
    `(${worst.avgScore.toFixed(2)} vs ${worst.avgExpected.toFixed(2)}, ${formatGap(worst.gap)})` +
    (headcount > 1
      ? `, where ${worst.belowCount} of ${worst.assessedCount} assessed people sit below expectation.`
      : ".");

  const th =
    `${who}ทำได้ดีที่สุดในสมรรถนะ ${bestName} ` +
    `(${best.avgScore.toFixed(2)} เทียบกับเกณฑ์ ${best.avgExpected.toFixed(2)} · ${formatGap(best.gap)}) ` +
    `และอ่อนที่สุดในสมรรถนะ ${worstName} ` +
    `(${worst.avgScore.toFixed(2)} เทียบกับเกณฑ์ ${worst.avgExpected.toFixed(2)} · ${formatGap(worst.gap)})` +
    (headcount > 1
      ? ` โดยมี ${worst.belowCount} จาก ${worst.assessedCount} คนที่ต่ำกว่าเกณฑ์`
      : "");

  return <>{tt(en, th)}</>;
}
