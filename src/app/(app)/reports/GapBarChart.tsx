"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  VERDICT_HEX,
  VerdictDot,
  useVerdictLabel,
} from "@/components/profile/VerdictPill";
import type { AggRow } from "@/components/profile/gap";
import type { GapVerdict } from "@/data/competencies";

export type BarDatum = {
  name: string;
  actual: number;
  expected: number;
  fill: string;
};

export function toBarData(rows: AggRow[]): BarDatum[] {
  return rows.map((r) => ({
    name: r.competency.name,
    actual: r.avgManager,
    expected: r.avgExpected,
    fill: VERDICT_HEX[r.verdict],
  }));
}

const AXIS_WIDTH = 190;
const LINE_HEIGHT = 15;
const MAX_CHARS = 24;

/** Break a competency name on word boundaries, at most two lines. */
function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= MAX_CHARS) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  const tail = lines.slice(1).join(" ");
  return [
    lines[0]!,
    tail.length > MAX_CHARS ? `${tail.slice(0, MAX_CHARS - 1)}…` : tail,
  ];
}

/**
 * Recharts packs wrapped tick lines almost on top of each other. Rendering the
 * tick ourselves is the only way to control the break points and the leading.
 */
function CompetencyTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const label = String(payload?.value ?? "");
  const lines = wrapLabel(label);
  const cx = (x ?? 0) - 10;
  // centre the block of lines on the row
  const top = (y ?? 0) - ((lines.length - 1) * LINE_HEIGHT) / 2 + 4;

  return (
    <text x={cx} y={top} textAnchor="end" fill="#1c1e29" fontSize={11}>
      <title>{label}</title>
      {lines.map((line, i) => (
        <tspan key={line + i} x={cx} dy={i === 0 ? 0 : LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

const VERDICT_ORDER: GapVerdict[] = [
  "strength",
  "standard",
  "development",
  "critical",
];

/**
 * Average score vs expected level, one horizontal pair per competency.
 * Horizontal keeps the competency names readable at every breakpoint, and the
 * score bar is tinted by its gap verdict so shortfalls read at a glance.
 */
export function GapBarChart({
  data,
  actualLabel,
  expectedLabel,
  verdictKeyLabel,
}: {
  data: BarDatum[];
  actualLabel: string;
  expectedLabel: string;
  /** caption above the verdict colour key */
  verdictKeyLabel: string;
}) {
  const verdictLabel = useVerdictLabel();
  // two-line labels need the extra room, otherwise rows collide
  const height = Math.max(240, data.length * 52 + 56);

  return (
    <div className="w-full">
      <div style={{ height }} className="min-w-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
            barGap={5}
          >
            <CartesianGrid horizontal={false} stroke="#dde1e6" />
            <XAxis
              type="number"
              domain={[0, 4]}
              ticks={[0, 1, 2, 3, 4]}
              tick={{ fill: "#697077", fontSize: 11 }}
              axisLine={{ stroke: "#dde1e6" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={AXIS_WIDTH}
              tick={<CompetencyTick />}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "#f2f0f2" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #dde1e6",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#697077", paddingTop: 10 }}
            />
            {/* expectation is the reference line, so it stays a neutral grey and
                lets the verdict-tinted score bar carry the meaning */}
            <Bar
              name={expectedLabel}
              dataKey="expected"
              fill="#a2a9b0"
              radius={[0, 4, 4, 0]}
              barSize={8}
              isAnimationActive={false}
            >
              {/* every series needs its own Cell list, otherwise recharts
                  applies the next series' cells to this one as well */}
              {data.map((d) => (
                <Cell key={`e-${d.name}`} fill="#a2a9b0" />
              ))}
            </Bar>
            <Bar
              name={actualLabel}
              dataKey="actual"
              fill="#006bff"
              radius={[0, 4, 4, 0]}
              barSize={8}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={`a-${d.name}`} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* the score bar is coloured by verdict, so the key belongs with it */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 pt-3 text-[11px] text-muted">
        <span className="font-medium text-ink">{verdictKeyLabel}</span>
        {VERDICT_ORDER.map((v) => (
          <span key={v} className="flex items-center gap-1.5">
            <VerdictDot verdict={v} className="size-2" />
            {verdictLabel(v)}
          </span>
        ))}
      </div>
    </div>
  );
}
