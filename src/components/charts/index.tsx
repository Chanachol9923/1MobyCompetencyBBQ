"use client";

import {
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#dde1e6" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: "#697077", fontSize: 11 }}
          />
          <PolarRadiusAxis domain={[0, 4]} tick={false} axisLine={false} />
          <Radar
            name="Expectation"
            dataKey="expectation"
            stroke="#c1c7cd"
            fill="#c1c7cd"
            fillOpacity={0.25}
          />
          <Radar
            name="Employee Skill Point"
            dataKey="actual"
            stroke="#faa21b"
            fill="#faa21b"
            fillOpacity={0.6}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #dde1e6",
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
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
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* recharts 2.x + React 19 never advances the mount animation, which
              leaves the sectors unrendered - draw them at their final value */}
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={1}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #dde1e6",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
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

export { Legend };
