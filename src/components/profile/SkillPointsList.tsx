"use client";

import { Progress } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatGap, type GapRow } from "./gap";
import { VerdictDot, useVerdictLabel } from "./VerdictPill";
import type { GapVerdict } from "@/data/competencies";

/**
 * "Skills / Self / Manager / Expectation" list used on the dashboard and Team
 * Profile. The Figma shows a single value — the 180° model needs both halves,
 * so self and manager sit side by side with the gap verdict next to them.
 */
export function SkillPointsList({
  rows,
  className,
  compact = false,
  showSelf = true,
  fill = false,
}: {
  rows: GapRow[];
  className?: string;
  compact?: boolean;
  showSelf?: boolean;
  /** stretch to the container height so rows share it evenly with a chart */
  fill?: boolean;
}) {
  const { t, tt, lang } = useT();
  const verdictLabel = useVerdictLabel();
  const text = compact ? "text-[11px]" : "text-xs";
  const head = compact ? "text-[10px]" : "text-xs";

  return (
    <div className={cn("flex min-w-0 flex-col", fill && "h-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 border-b border-line/70 pb-2 text-muted",
          head,
        )}
      >
        <span className="flex-1">{t("label.skills")}</span>
        {showSelf ? (
          <span className="w-10 shrink-0 text-center">{t("mode.self")}</span>
        ) : null}
        <span className="w-12 shrink-0 text-center">
          {tt("Manager", "หัวหน้า")}
        </span>
        <span className="w-14 shrink-0 text-center">{t("label.expected")}</span>
      </div>

      <ul
        className={cn(
          "mt-3",
          fill && rows.length
            ? "flex flex-1 flex-col justify-between gap-3"
            : compact
              ? "space-y-2.5"
              : "space-y-3.5",
        )}
      >
        {rows.map((r) => (
          <li key={r.competency.id}>
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-muted" />
              <span
                className={cn("min-w-0 flex-1 truncate text-ink", text)}
                title={
                  lang === "th"
                    ? r.competency.definitionTh
                    : r.competency.definition
                }
              >
                {r.competency.name}
              </span>
              {showSelf ? (
                <span className={cn("w-10 shrink-0 text-center text-muted", text)}>
                  {r.self}
                </span>
              ) : null}
              <span
                className={cn("w-12 shrink-0 text-center font-bold text-ink", text)}
              >
                {r.manager}
              </span>
              <span className="flex w-14 shrink-0 justify-center">
                <span
                  className={cn("rounded-md bg-surface px-3 py-0.5 text-muted", text)}
                >
                  {r.expected}
                </span>
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <Progress
                className="min-w-0 flex-1"
                tone="amber"
                value={(r.manager / 4) * 100}
              />
              <span
                className={cn(
                  "w-8 shrink-0 text-right tabular-nums",
                  compact ? "text-[10px]" : "text-[11px]",
                  r.gap < 0 ? "text-accent" : "text-muted",
                )}
                title={t("label.gap")}
              >
                {formatGap(r.gap)}
              </span>
              <span className="flex w-3 shrink-0 justify-center">
                <VerdictDot verdict={r.verdict} />
              </span>
            </div>
          </li>
        ))}

        {rows.length === 0 ? (
          <li className={cn("py-6 text-center text-muted", text)}>
            {tt(
              "Not assessed on this competency group.",
              "ไม่ได้ถูกประเมินในกลุ่มสมรรถนะนี้",
            )}
          </li>
        ) : null}
      </ul>

      {/* the dots carry the verdict, so the key has to be on the card */}
      {rows.length ? (
        <ul
          className={cn(
            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 pt-2 text-muted",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          {(
            ["strength", "standard", "development", "critical"] as GapVerdict[]
          ).map((v) => (
            <li key={v} className="flex items-center gap-1.5">
              <VerdictDot verdict={v} className="size-2" />
              {verdictLabel(v)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
