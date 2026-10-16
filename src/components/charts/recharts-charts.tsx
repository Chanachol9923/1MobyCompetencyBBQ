"use client";

/**
 * The parts of the charts that need Recharts (~100 KB of script). Nothing
 * imports this file directly: `index.tsx` loads it on demand, after the page
 * is on screen, so a page with a chart is not held up by the chart library.
 */

import {
  Cell,
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
import type { DonutSlice, RadarDatum } from "./index";

export default function CompetencyRadarChart({
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

/** The ring of a donut; the total in its middle is drawn by `Donut`. */
export function DonutRing({ data }: { data: DonutSlice[] }) {
  return (
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
  );
}
