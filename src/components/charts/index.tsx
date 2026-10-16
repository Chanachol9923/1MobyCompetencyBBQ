"use client";

import dynamic from "next/dynamic";

/** Grey stand-in with the chart's exact footprint, so nothing moves when it arrives. */
function ChartPlaceholder({ round }: { round?: boolean }) {
  return (
    <div
      aria-hidden
      className={`h-full w-full animate-pulse bg-surface ${round ? "rounded-full" : "rounded-xl"}`}
    />
  );
}

const RadarImpl = dynamic(() => import("./recharts-charts"), {
  ssr: false,
  loading: () => <ChartPlaceholder />,
});
const RingImpl = dynamic(() => import("./recharts-charts").then((m) => m.DonutRing), {
  ssr: false,
  loading: () => <ChartPlaceholder round />,
});

export type RadarDatum = { skill: string; expectation: number; actual: number };

export function CompetencyRadar({
  data,
  height = 260,
}: {
  data: RadarDatum[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <RadarImpl data={data} height={height} />
    </div>
  );
}

export type DonutSlice = { name: string; value: number; color: string };

export function Donut({
  data,
  total,
  totalLabel = "TOTAL",
  size = 190,
  dark = false,
}: {
  data: DonutSlice[];
  total: number;
  totalLabel?: string;
  size?: number;
  dark?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <RingImpl data={data} />
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span
          className={`text-[10px] font-medium ${dark ? "text-white/70" : "text-muted"}`}
        >
          {totalLabel}
        </span>
        <span
          className={`text-2xl font-bold ${dark ? "text-white" : "text-ink"}`}
        >
          {total}
        </span>
      </div>
    </div>
  );
}

export function DonutLegend({
  data,
  dark = false,
}: {
  data: DonutSlice[];
  dark?: boolean;
}) {
  return (
    <ul className="space-y-2 text-xs">
      {data.map((d) => (
        <li key={d.name} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ background: d.color }}
          />
          <span className={dark ? "text-white/85" : "text-muted"}>{d.name}</span>
          <span
            className={`ml-auto font-semibold ${dark ? "text-white" : "text-ink"}`}
          >
            {d.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Pastel cell colours used in the Team Competency heat map. */
export function heatColor(score: number) {
  if (score >= 4) return "#c2ffd4";
  if (score === 3) return "#f7f9c4";
  if (score === 2) return "#f7dbc7";
  return "#f7c1c7";
}

