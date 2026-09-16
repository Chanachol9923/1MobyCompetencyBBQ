"use client";

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
  formatDate,
  groupDictKey,
  percentOf,
  pick,
  runHref,
  signed,
  weightedFromParts,
  type AssessmentStatus,
} from "@/components/assessment/lib";
import { VERDICT_LABEL, VERDICT_ORDER } from "@/components/profile/gap";
import type {
  CycleSummary,
  HubData,
  HubReport,
} from "@/server/assessment";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const VERDICT_COLOR = {
  strength: "text-success",
  standard: "text-brand",
  development: "text-[#b57408]",
  critical: "text-accent",
} as const;

/**
 * The hub: what the viewer still owes this cycle, what their team still owes
 * them, and what came back about them.
 *
 * Everything on screen arrives as props from the server — this component holds
 * no state and reads no store, so what it shows is what is in the database.
 */
export function AssessmentHubView({
  viewerId,
  viewerName,
  jobRoleName,
  canSelfAssess,
  data,
}: {
  viewerId: string;
  viewerName: string;
  jobRoleName: string | null;
  canSelfAssess: boolean;
  data: HubData & { cycle: CycleSummary };
}) {
  const { t, tt, lang } = useT();
  const { cycle, self, reports, result, groups } = data;

  const groupsLabel = groups.map((g) => t(groupDictKey(g))).join(" · ");
  const closes = formatDate(cycle.endsAt, lang);
  const cycleName = pick(lang, cycle.nameEn, cycle.nameTh);

  const weighted = result
    ? weightedFromParts(cycle.weights, result.parts, groups)
    : null;

  const focus = (result?.rows ?? [])
    .filter((r) => r.verdict === "critical" || r.verdict === "development")
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);

  const doneReviews = reports.filter((r) => r.status === "submitted").length;

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
            {tt("Current cycle", "รอบการประเมินปัจจุบัน")} · {cycleName}
          </p>
          <p className="break-words text-xs leading-relaxed text-muted">
            {groupsLabel
              ? tt(
                  `Closes ${closes}. ${viewerName} is assessed as ${jobRoleName ?? ""} on ${groupsLabel} plus KPI.`,
                  `ปิดรอบ ${closes} — ${viewerName} ถูกประเมินในฐานะ ${jobRoleName ?? ""} ในกลุ่ม ${groupsLabel} และ KPI`,
                )
              : tt(
                  `Closes ${closes}. No competency has an expected level for this career role yet.`,
                  `ปิดรอบ ${closes} — ยังไม่มีสมรรถนะใดกำหนดระดับที่คาดหวังสำหรับตำแหน่งนี้`,
                )}
          </p>
        </div>
        <Pill tone={cycle.status === "OPEN" ? "brand" : "neutral"}>
          {cycle.status === "OPEN"
            ? tt("Open", "เปิดรับ")
            : tt("Closed", "ปิดแล้ว")}{" "}
          · {tt("closes", "ปิด")} {closes}
        </Pill>
      </Card>

      {/* --------------------------------------------------------- self */}
      {canSelfAssess ? (
        <Card className="flex flex-col">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-brand" />
                {tt("Self assessment", "ประเมินตนเอง")}
              </span>
            }
            subtitle={tt(
              "Rate yourself against the expected level for your career role.",
              "ให้คะแนนตนเองเทียบกับระดับที่คาดหวังของตำแหน่ง",
            )}
            right={<StatusPill status={self.status} />}
          />
          <div className="mt-auto px-5 pb-5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{t("label.progress")}</span>
              <span className="font-medium text-ink">
                {self.answered}/{self.required}
              </span>
            </div>
            <Progress
              className="mt-2"
              value={percentOf(self.answered, self.required)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={runHref("self", viewerId)}>
                <Button>
                  {actionLabel(self.status, {
                    start: tt("Start self assessment", "เริ่มประเมินตนเอง"),
                    resume: tt("Continue", "ทำต่อ"),
                    view: tt("View result", "ดูผลการประเมิน"),
                  })}
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <span className="self-center text-xs text-muted">
                {self.competencyCount} {tt("competencies", "สมรรถนะ")} ·{" "}
                {self.kpiCount} KPI
                {self.submittedAt
                  ? ` · ${tt("submitted", "ส่งเมื่อ")} ${formatDate(self.submittedAt, lang)}`
                  : ""}
              </span>
            </div>
          </div>
        </Card>
      ) : null}

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
              <Pill tone={doneReviews === reports.length ? "success" : "neutral"}>
                {doneReviews}/{reports.length} {tt("done", "เสร็จ")}
              </Pill>
            }
          />
          <ul className="divide-y divide-line/60 px-5 pb-5">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} />
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
            result ? (
              <Pill tone="success">
                {tt("Submitted", "ส่งเมื่อ")} {formatDate(result.submittedAt, lang)}
              </Pill>
            ) : null
          }
        />
        <div className="px-5 pb-5">
          {result && weighted ? (
            <>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs text-muted">
                    {tt("Weighted total", "คะแนนรวมถ่วงน้ำหนัก")}
                  </p>
                  <p className="mt-0.5 text-4xl font-bold text-brand">
                    {weighted.total === null ? "—" : weighted.total.toFixed(2)}
                    <span className="text-lg font-medium text-muted"> / 4</span>
                  </p>
                </div>
                <div className="min-w-[180px] flex-1">
                  <Progress value={weighted.percent ?? 0} showLabel />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {VERDICT_ORDER.map((v) => (
                  <div
                    key={v}
                    className="rounded-lg border border-line/70 bg-surface/50 p-3"
                  >
                    <p className="break-words text-xs text-muted">
                      {VERDICT_LABEL[v][lang]}
                    </p>
                    <p className={cn("mt-1 text-2xl font-bold", VERDICT_COLOR[v])}>
                      {result.counts[v]}
                    </p>
                  </div>
                ))}
              </div>

              {focus.length ? (
                <div className="mt-5">
                  <p className="text-xs font-medium text-ink">
                    {tt("Focus next", "ควรพัฒนาต่อไป")}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {focus.map((r) => (
                      <li
                        key={r.competencyId}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-line/70 px-4 py-2.5"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                          {pick(lang, r.nameEn, r.nameTh)}
                        </span>
                        <span className="text-xs text-muted">
                          {r.score} / {t("label.expected")} {r.expected} (
                          {signed(r.gap)})
                        </span>
                        <VerdictPill verdict={r.verdict} />
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
                {canSelfAssess ? (
                  <Link href={runHref("self", viewerId)}>
                    <Button variant="outline">
                      {tt(
                        "Compare with my self rating",
                        "เทียบกับคะแนนที่ประเมินตนเอง",
                      )}
                    </Button>
                  </Link>
                ) : null}
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

/* ------------------------------------------------------------- report row */

function ReportRow({ report }: { report: HubReport }) {
  const { t, tt } = useT();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={report.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{report.name}</p>
        <p className="truncate text-xs text-muted">
          {[report.position, report.jobRole].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="text-xs text-muted">
        {report.answered}/{report.required} {t("label.progress").toLowerCase()}
      </span>
      <StatusPill status={report.status} />
      <Link href={runHref("supervisor", report.id)}>
        <Button
          size="sm"
          variant={report.status === "submitted" ? "outline" : "primary"}
        >
          {actionLabel(report.status, {
            start: tt("Review", "เริ่มประเมิน"),
            resume: tt("Continue", "ทำต่อ"),
            view: tt("View", "ดูผล"),
          })}
        </Button>
      </Link>
    </li>
  );
}

function actionLabel(
  status: AssessmentStatus,
  labels: { start: string; resume: string; view: string },
) {
  if (status === "submitted") return labels.view;
  if (status === "in-progress") return labels.resume;
  return labels.start;
}
