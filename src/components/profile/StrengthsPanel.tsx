"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { VerdictPill, useVerdictLabel } from "./VerdictPill";
import { formatGap, nameOf, pick, type GapRow } from "./gap";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A development goal that already covers a competency. */
export type GoalHint = {
  competencyId: string;
  titleEn: string;
  titleTh: string | null;
};

/** A published course written for a competency. */
export type CourseHint = {
  competencyId: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
};

/**
 * "แนะนำจุดแข็ง และจุดที่ควรพัฒนาอัตโนมัติ" for one person.
 *
 * /reports generates the same read for a whole team, but an employee has no
 * route-level access to it — so the individual profile carries its own copy of
 * the panel. Everything is derived from the gap rows the server handed down:
 * the score, the expected level, the gap and the verdict. Nothing here is
 * written by hand, a competency the role is not assessed on never reaches this
 * component, and a competency nobody has scored yet is left out of the read
 * rather than counted as meeting expectation.
 */
export function StrengthsPanel({
  rows,
  goals,
  courses,
  className,
}: {
  rows: GapRow[];
  goals: GoalHint[];
  courses: CourseHint[];
  className?: string;
}) {
  const { t, tt, lang } = useT();
  const verdictLabel = useVerdictLabel();
  const router = useRouter();

  const scored = rows.filter((r) => r.score !== null);
  if (!scored.length) return null;

  const byGapDesc = [...scored].sort(
    (a, b) => b.gap - a.gap || (b.score ?? 0) - (a.score ?? 0),
  );
  const atOrAbove = byGapDesc.filter((r) => r.gap >= 0);
  /** Strengths are the ones clear of expectation; if none, the best three. */
  const strengths = (atOrAbove.length ? atOrAbove : byGapDesc).slice(0, 3);
  const shortfalls = scored
    .filter((r) => r.gap < 0)
    .sort((a, b) => a.gap - b.gap);

  const best = strengths[0]!;
  const worst = shortfalls[0];
  const bestName = nameOf(best, lang);

  /** Same generated-sentence shape /reports uses, for one person. */
  const openingEn =
    `You are strongest at ${bestName} ` +
    `(${best.score} vs ${best.expected} expected, ${formatGap(best.gap)} — ${verdictLabel(best.verdict)}).`;
  const openingTh =
    `คุณทำได้ดีที่สุดในสมรรถนะ ${bestName} ` +
    `(${best.score} เทียบกับเกณฑ์ ${best.expected} · ${formatGap(best.gap)} — ${verdictLabel(best.verdict)})`;

  const closingEn = worst
    ? ` ${shortfalls.length} of ${scored.length} scored competencies sit below expectation, starting with ` +
      `${nameOf(worst, lang)} (${worst.score} vs ${worst.expected}, ${formatGap(worst.gap)}).`
    : ` You are at or above the expected level on all ${scored.length} competencies scored so far — keep the level and stretch the strongest ones.`;
  const closingTh = worst
    ? ` มี ${shortfalls.length} จาก ${scored.length} สมรรถนะที่ต่ำกว่าเกณฑ์ เริ่มจาก ` +
      `${nameOf(worst, lang)} (${worst.score} เทียบกับเกณฑ์ ${worst.expected} · ${formatGap(worst.gap)})`
    : ` คุณอยู่ในระดับที่คาดหวังหรือสูงกว่าครบทั้ง ${scored.length} สมรรถนะที่มีคะแนนแล้ว รักษาระดับนี้ไว้และต่อยอดจุดแข็ง`;

  const goalFor = (competencyId: string) =>
    goals.find((g) => g.competencyId === competencyId);
  const courseFor = (competencyId: string) =>
    courses.find((c) => c.competencyId === competencyId);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title={tt(
          "Your strengths and what to develop",
          "จุดแข็งของคุณและสิ่งที่ควรพัฒนา",
        )}
        subtitle={tt("Based on your manager's scores against the expected level for your role",
          "สรุปจากคะแนนที่หัวหน้าประเมินเทียบกับระดับที่คาดหวังของบทบาทคุณ",
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
                <li key={r.competencyId} className="flex items-start gap-2">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {nameOf(r, lang)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      {tt("score", "คะแนน")} {r.score} ·{" "}
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
                  const goal = goalFor(r.competencyId);
                  const course = courseFor(r.competencyId);
                  return (
                    <li key={r.competencyId} className="flex items-start gap-2">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink">
                          {nameOf(r, lang)}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          {tt("score", "คะแนน")} {r.score} ·{" "}
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
                              `In your plan: ${pick(lang, goal.titleEn, goal.titleTh)}`,
                              `อยู่ในแผนแล้ว: ${pick(lang, goal.titleEn, goal.titleTh)}`,
                            )}
                          </Button>
                        ) : course ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 lg:-ml-3"
                            onClick={() => router.push(`/lms/${course.slug}`)}
                          >
                            <GraduationCap size={13} />
                            {tt(
                              `Start ${pick(lang, course.titleEn, course.titleTh)}`,
                              `เริ่มเรียน ${pick(lang, course.titleEn, course.titleTh)}`,
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
