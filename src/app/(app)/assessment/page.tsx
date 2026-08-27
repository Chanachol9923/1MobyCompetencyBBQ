"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Eye,
  ShieldCheck,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeading,
  Pill,
  Progress,
} from "@/components/ui";
import { StatusPill, VerdictPill } from "@/components/assessment/StatusPill";
import {
  CYCLE,
  allCompetenciesFor,
  answeredCount,
  competenciesFor,
  gapRows,
  getRecord,
  kpiItemsFor,
  kpiKey,
  managerAnswersFor,
  requiredCount,
  runHref,
  statusOf,
  verdictCounts,
  weightedTotal,
  type Mode,
  type Status,
} from "@/components/assessment/lib";
import { GAP_VERDICT_LABEL, type GapVerdict } from "@/data/competencies";
import { directReportsOf, type Person } from "@/data/people";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const VERDICT_ORDER: GapVerdict[] = [
  "strength",
  "standard",
  "development",
  "critical",
];

const VERDICT_COLOR: Record<GapVerdict, string> = {
  strength: "text-success",
  standard: "text-brand",
  development: "text-[#b57408]",
  critical: "text-accent",
};

export default function AssessmentHubPage() {
  const { state, person } = useDemo();
  const { t, tt, lang } = useT();

  const me = person?.id ?? "";

  const reports = useMemo(() => (person ? directReportsOf(person.id) : []), [person]);

  if (!person) return null;

  /* ------------------------------------------------------------ self card */

  const selfRecord = getRecord(state, "self", me, me);
  const selfStatus = statusOf(selfRecord);
  const myKpi = kpiItemsFor(state, me);
  const myRequired = requiredCount(person.jobRole, myKpi);
  const myAnswered = answeredCount(person.jobRole, myKpi, selfRecord);
  const myPercent = myRequired
    ? Math.round((myAnswered / myRequired) * 100)
    : 0;

  const groupsLabel = (["core", "functional", "managerial"] as const)
    .filter((g) => competenciesFor(person.jobRole, g).length > 0)
    .map((g) => t(`group.${g}`))
    .join(" · ");

  /* ---------------------------------------------------------- my result */

  const managerAnswers = managerAnswersFor(state, person);
  const officialAnswers = (() => {
    if (!managerAnswers) return null;
    const fromKpi: Record<string, number> = {};
    myKpi.forEach((i) => {
      if (i.score) fromKpi[kpiKey(i.id)] = i.score;
    });
    return { ...fromKpi, ...managerAnswers.answers };
  })();

  const official = officialAnswers
    ? weightedTotal(person.jobRole, officialAnswers, myKpi, state.weights)
    : null;
  const officialRows = officialAnswers
    ? gapRows(person.jobRole, officialAnswers)
    : [];
  const counts = verdictCounts(officialRows);
  const topCritical = officialRows
    .filter((r) => r.verdict === "critical" || r.verdict === "development")
    .slice(0, 3);

  /* ----------------------------------------------------------------- ui */

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.assessment")}
        subtitle={tt(
          "180° assessment — self and supervisor, scored on KPI plus competency.",
          "การประเมินแบบ 180 องศา — ประเมินตนเองและประเมินโดยหัวหน้า คิดคะแนนจาก KPI ร่วมกับสมรรถนะ",
        )}
      />

      {/* --------------------------------------------------------- cycle */}
      <Card className="mb-6 flex flex-wrap items-center gap-4 border-brand/30 bg-brand-tint/50 p-5">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-brand">
          <CalendarClock size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {tt("Current cycle", "รอบการประเมินปัจจุบัน")} ·{" "}
            {lang === "th" ? CYCLE.nameTh : CYCLE.nameEn}
          </p>
          <p className="break-words text-xs leading-relaxed text-muted">
            {tt(
              `Closes ${CYCLE.closesEn}. You are assessed as ${person.jobRole} (${person.level}) on ${groupsLabel} plus KPI.`,
              `ปิดรอบ ${CYCLE.closesTh} คุณถูกประเมินในฐานะ ${person.jobRole} (${person.level}) ในกลุ่ม ${groupsLabel} และ KPI`,
            )}
          </p>
        </div>
        <Pill tone="brand">
          {tt("Open", "เปิดรับ")} · {tt("closes", "ปิด")}{" "}
          {lang === "th" ? CYCLE.closesTh : CYCLE.closesEn}
        </Pill>
      </Card>

      {/* --------------------------------------------------------- self */}
      <Card className="flex flex-col">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-brand" />
              {tt("Self assessment", "ประเมินตนเอง")}
            </span>
          }
          subtitle={tt(
            "Rate yourself against the expected level for your role.",
            "ให้คะแนนตนเองเทียบกับระดับที่คาดหวังของตำแหน่ง",
          )}
          right={<StatusPill status={selfStatus} />}
        />
        <div className="mt-auto px-5 pb-5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t("label.progress")}</span>
            <span className="font-medium text-ink">
              {myAnswered}/{myRequired}
            </span>
          </div>
          <Progress className="mt-2" value={myPercent} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={runHref("self", me)}>
              <Button>
                {selfStatus === "submitted"
                  ? tt("View result", "ดูผลการประเมิน")
                  : selfStatus === "in-progress"
                    ? tt("Continue", "ทำต่อ")
                    : tt("Start self assessment", "เริ่มประเมินตนเอง")}
                <ArrowRight size={16} />
              </Button>
            </Link>
            <span className="self-center text-xs text-muted">
              {allCompetenciesFor(person.jobRole).length}{" "}
              {tt("competencies", "สมรรถนะ")} · {myKpi.length} KPI
            </span>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------- supervisor */}
      {reports.length ? (
        <Card className="mt-5">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-brand" />
                {tt("Supervisor review", "ประเมินโดยหัวหน้า")}
              </span>
            }
            subtitle={tt(
              "Your direct reports. This review is the official result and drives the gap analysis.",
              "ผู้ใต้บังคับบัญชาโดยตรงของคุณ ผลนี้ถือเป็นผลอย่างเป็นทางการและใช้วิเคราะห์ส่วนต่าง",
            )}
            right={
              <Pill tone="neutral">
                {
                  reports.filter(
                    (p) =>
                      statusOf(getRecord(state, "supervisor", me, p.id)) ===
                      "submitted",
                  ).length
                }
                /{reports.length} {tt("done", "เสร็จ")}
              </Pill>
            }
          />
          <ul className="divide-y divide-line/60 px-5 pb-5">
            {reports.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                mode="supervisor"
                status={statusOf(getRecord(state, "supervisor", me, p.id))}
                showRole
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- my result */}
      <Card className="mt-5">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Eye size={18} className="text-brand" />
              {tt("Your result", "ผลการประเมินของคุณ")}
            </span>
          }
          subtitle={tt(
            "Weighted total and gap verdicts from the supervisor review — the official record.",
            "คะแนนรวมถ่วงน้ำหนักและผลวิเคราะห์ส่วนต่างจากการประเมินโดยหัวหน้า ซึ่งเป็นผลอย่างเป็นทางการ",
          )}
          right={
            managerAnswers ? (
              <Pill tone={managerAnswers.source === "review" ? "success" : "neutral"}>
                {managerAnswers.source === "review"
                  ? tt("This cycle", "รอบนี้")
                  : tt("Last cycle", "รอบก่อนหน้า")}
              </Pill>
            ) : null
          }
        />
        <div className="px-5 pb-5">
          {official && managerAnswers ? (
            <>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs text-muted">
                    {tt("Weighted total", "คะแนนรวมถ่วงน้ำหนัก")}
                  </p>
                  <p className="mt-0.5 text-4xl font-bold text-brand">
                    {official.total === null ? "—" : official.total.toFixed(2)}
                    <span className="text-lg font-medium text-muted"> / 4</span>
                  </p>
                </div>
                <div className="min-w-[180px] flex-1">
                  <Progress value={official.percent ?? 0} showLabel />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {VERDICT_ORDER.map((v) => (
                  <div
                    key={v}
                    className="rounded-lg border border-line/70 bg-surface/50 p-3"
                  >
                    <p className="break-words text-xs text-muted">
                      {GAP_VERDICT_LABEL[v][lang]}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-bold",
                        VERDICT_COLOR[v],
                      )}
                    >
                      {counts[v]}
                    </p>
                  </div>
                ))}
              </div>

              {topCritical.length ? (
                <div className="mt-5">
                  <p className="text-xs font-medium text-ink">
                    {tt("Focus next", "ควรพัฒนาต่อไป")}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {topCritical.map((r) => (
                      <li
                        key={r.competency.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-line/70 px-4 py-2.5"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                          {r.competency.name}
                        </span>
                        <span className="text-xs text-muted">
                          {r.score} / {t("label.expected")} {r.expected}
                        </span>
                        {r.verdict ? <VerdictPill verdict={r.verdict} /> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/idp">
                  <Button variant="secondary">
                    {tt("Open my IDP", "เปิดแผนพัฒนาของฉัน")}
                  </Button>
                </Link>
                <Link href={runHref("self", me)}>
                  <Button variant="outline">
                    {tt("Compare with my self rating", "เทียบกับคะแนนที่ประเมินตนเอง")}
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              title={tt(
                "No supervisor review yet",
                "ยังไม่มีผลการประเมินจากหัวหน้า",
              )}
              hint={tt(
                "Your weighted total and gap analysis appear here once your supervisor submits their review.",
                "คะแนนรวมถ่วงน้ำหนักและการวิเคราะห์ส่วนต่างจะแสดงที่นี่เมื่อหัวหน้าส่งผลการประเมินแล้ว",
              )}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- person row */

function PersonRow({
  person,
  mode,
  status,
  showRole = false,
}: {
  person: Person;
  mode: Mode;
  status: Status;
  showRole?: boolean;
}) {
  const { tt } = useT();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={person.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{person.name}</p>
        <p className="truncate text-xs text-muted">
          {showRole ? `${person.position} · ${person.jobRole}` : person.position}
        </p>
      </div>
      <StatusPill status={status} />
      <Link href={runHref(mode, person.id)}>
        <Button size="sm" variant={status === "submitted" ? "outline" : "primary"}>
          {status === "submitted"
            ? tt("View", "ดูผล")
            : status === "in-progress"
              ? tt("Continue", "ทำต่อ")
              : tt("Review", "เริ่มประเมิน")}
        </Button>
      </Link>
    </li>
  );
}
