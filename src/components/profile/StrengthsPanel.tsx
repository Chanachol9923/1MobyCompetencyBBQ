"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { VerdictPill, useVerdictLabel } from "./VerdictPill";
import { formatGap, type GapRow } from "./gap";
import { coursesForCompetency } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { IdpGoal } from "@/lib/store";

/**
 * "แนะนำจุดแข็ง และจุดที่ควรพัฒนาอัตโนมัติ" for one person.
 *
 * /reports generates the same read for a whole team, but an employee has no
 * route-level access to it — so the individual profile carries its own copy of
 * the panel. Everything is derived from `gapRows`: the score, the expected
 * level, the gap and the verdict. Nothing here is written by hand, and a
 * competency the role is not assessed on never reaches this component because
 * `gapRows` already filtered it out.
 */
export function StrengthsPanel({
  rows,
  goals,
  className,
}: {
  rows: GapRow[];
  goals: IdpGoal[];
  className?: string;
}) {
  const { t, tt } = useT();
  const verdictLabel = useVerdictLabel();
  const router = useRouter();

  if (!rows.length) return null;

  const byGapDesc = [...rows].sort(
    (a, b) => b.gap - a.gap || b.manager - a.manager,
  );
  const atOrAbove = byGapDesc.filter((r) => r.gap >= 0);
  /** Strengths are the ones clear of expectation; if none, the best three. */
  const strengths = (atOrAbove.length ? atOrAbove : byGapDesc).slice(0, 3);
  const shortfalls = rows
    .filter((r) => r.gap < 0)
    .sort((a, b) => a.gap - b.gap);

  const best = strengths[0]!;
  const worst = shortfalls[0];

  /** Same generated-sentence shape /reports uses, for one person. */
  const openingEn =
    `You are strongest at ${best.competency.name} ` +
    `(${best.manager} vs ${best.expected} expected, ${formatGap(best.gap)} — ${verdictLabel(best.verdict)}).`;
  const openingTh =
    `คุณทำได้ดีที่สุดในสมรรถนะ ${best.competency.name} ` +
    `(${best.manager} เทียบกับเกณฑ์ ${best.expected} · ${formatGap(best.gap)} — ${verdictLabel(best.verdict)})`;

  const closingEn = worst
    ? ` ${shortfalls.length} of ${rows.length} assessed competencies sit below expectation, starting with ` +
      `${worst.competency.name} (${worst.manager} vs ${worst.expected}, ${formatGap(worst.gap)}).`
    : ` You are at or above the expected level on all ${rows.length} competencies you are assessed on — keep the level and stretch the strongest ones.`;
  const closingTh = worst
    ? ` มี ${shortfalls.length} จาก ${rows.length} สมรรถนะที่ต่ำกว่าเกณฑ์ เริ่มจาก ` +
      `${worst.competency.name} (${worst.manager} เทียบกับเกณฑ์ ${worst.expected} · ${formatGap(worst.gap)})`
    : ` คุณอยู่ในระดับที่คาดหวังหรือสูงกว่าครบทั้ง ${rows.length} สมรรถนะที่ถูกประเมิน รักษาระดับนี้ไว้และต่อยอดจุดแข็ง`;

  const goalFor = (competencyId: string) =>
    goals.find((g) => g.competencyId === competencyId);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title={tt(
          "Your strengths and what to develop",
          "จุดแข็งของคุณและสิ่งที่ควรพัฒนา",
        )}
        subtitle={tt(
          "Generated from your manager score against the expected level for your role",
          "สรุปจากคะแนนที่หัวหน้าประเมินเทียบกับระดับที่คาดหวังของตำแหน่งคุณ",
        )}
      />
      <div className="px-5 pb-5">
        <p className="rounded-lg bg-brand-tint px-4 py-3 text-sm leading-relaxed text-ink">
          {tt(openingEn + closingEn, openingTh + closingTh)}
        </p>

        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
          {/* ------------------------------------------------- strengths */}
          <div className="flex min-w-0 flex-col rounded-lg border border-line/70 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
              {tt("Strongest at", "ทำได้ดีที่สุด")}
            </p>
            <ul className="space-y-3">
              {strengths.map((r) => (
                <li key={r.competency.id} className="flex items-start gap-2">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {r.competency.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      {tt("score", "คะแนน")} {r.manager} ·{" "}
                      {t("label.expected")} {r.expected}
                      <VerdictPill verdict={r.verdict} compact />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-bold tabular-nums",
                      r.gap < 0 ? "text-accent" : "text-success",
                    )}
                  >
                    {formatGap(r.gap)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------------------------------------------- what to develop */}
          <div className="flex min-w-0 flex-col rounded-lg border border-line/70 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
              {tt("What to develop", "สิ่งที่ควรพัฒนา")}
            </p>
            {shortfalls.length === 0 ? (
              <p className="flex-1 text-[13px] leading-relaxed text-muted">
                {tt(
                  "Nothing is below expectation right now. There is no development area to flag — the plan below is about stretching further, not catching up.",
                  "ตอนนี้ไม่มีสมรรถนะใดต่ำกว่าเกณฑ์ จึงไม่มีจุดที่ต้องเร่งพัฒนา แผนด้านล่างจึงเป็นการต่อยอด ไม่ใช่การไล่ตาม",
                )}
              </p>
            ) : (
              <ul className="space-y-3">
                {shortfalls.map((r) => {
                  const goal = goalFor(r.competency.id);
                  const course = coursesForCompetency(r.competency.id)[0];
                  return (
                    <li key={r.competency.id} className="flex items-start gap-2">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink">
                          {r.competency.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          {tt("score", "คะแนน")} {r.manager} ·{" "}
                          {t("label.expected")} {r.expected} · {t("label.gap")}{" "}
                          <b className="text-accent">{formatGap(r.gap)}</b>
                          <VerdictPill verdict={r.verdict} compact />
                        </span>
                        {goal ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 lg:-ml-3"
                            onClick={() => router.push("/idp")}
                          >
                            <ArrowUpRight size={13} />
                            {tt(
                              `In your plan: ${goal.courseTitle}`,
                              `อยู่ในแผนแล้ว: ${goal.courseTitle}`,
                            )}
                          </Button>
                        ) : course ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 lg:-ml-3"
                            onClick={() => router.push(`/lms/${course.id}`)}
                          >
                            <GraduationCap size={13} />
                            {tt(
                              `Start ${course.title}`,
                              `เริ่มเรียน ${course.title}`,
                            )}
                          </Button>
                        ) : (
                          <span className="mt-1 block text-[11px] text-muted">
                            {tt(
                              "No course covers this yet — ask your manager for coaching or on-the-job training.",
                              "ยังไม่มีหลักสูตรที่ตรงกับสมรรถนะนี้ ปรึกษาหัวหน้าเพื่อขอโค้ชชิ่งหรือฝึกจากงานจริง",
                            )}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
