"use client";

import { CompetencyRadar, type RadarDatum } from "@/components/charts";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Radar chart with the "Over-all" caption and the
 * Expectation / Employee Skill Point legend pinned top-left (as per Figma).
 * Spokes are only ever the competencies the person is assessed on.
 */
export function RadarPanel({
  data,
  height = 280,
  label,
  className,
  fill = false,
}: {
  data: RadarDatum[];
  height?: number;
  label?: string;
  className?: string;
  /** stretch to the container height and centre the chart inside it */
  fill?: boolean;
}) {
  const { t, tt } = useT();

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center text-center",
          fill && "h-full",
          className,
        )}
        style={{ minHeight: height }}
      >
        <p className="max-w-[220px] text-xs text-muted">
          {tt(
            "Not assessed on this competency group.",
            "ไม่ได้ถูกประเมินในกลุ่มสมรรถนะนี้",
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative",
        fill && "flex h-full flex-col justify-center",
        className,
      )}
    >
      <div className="pointer-events-none absolute left-0 top-0 z-10">
        <p className="text-sm text-muted">{label ?? tt("Over-all", "ภาพรวม")}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-line-2" />
            {t("label.expected")}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-amber" />
            {t("label.actual")}
          </li>
        </ul>
      </div>
      <CompetencyRadar data={data} height={height} />
    </div>
  );
}
