/**
 * The assessment cycle, derived from today rather than hard-coded, so the demo
 * never drifts into "the cycle closed four months ago" when it is shown later.
 * One definition, used by the assessment wizard, the admin console and the IDP
 * seed, so the three can never disagree.
 */

const MONTH_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export function formatDay(d: Date | string, lang: "en" | "th") {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const m = date.getMonth();
  return lang === "th"
    ? `${day} ${MONTH_TH[m]} ${date.getFullYear() + 543}`
    : `${day} ${MONTH_EN[m]} ${date.getFullYear()}`;
}

export type Cycle = {
  id: string;
  quarter: number;
  year: number;
  nameEn: string;
  nameTh: string;
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  closesEn: string;
  closesTh: string;
  rangeEn: string;
  rangeTh: string;
  /** whole days between today and the close date, never negative */
  daysRemaining: number;
  /** 0-100, how far through the window we are */
  elapsedPct: number;
};

export function currentCycle(today = new Date()): Cycle {
  const year = today.getFullYear();
  const quarter = Math.floor(today.getMonth() / 3) + 1;
  // calendar days are stored as UTC midnight — the convention the admin screens
  // read back with toISOString().slice(0, 10). Local midnight would print as
  // the day before anywhere east of Greenwich (30-06 → 29-09 in Bangkok).
  const start = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
  const end = new Date(Date.UTC(year, quarter * 3, 0)); // day 0 of next month = last day
  const dayMs = 86_400_000;
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / dayMs),
  );
  const span = end.getTime() - start.getTime();
  const elapsedPct = Math.min(
    100,
    Math.max(0, Math.round(((today.getTime() - start.getTime()) / span) * 100)),
  );
  return {
    id: `${year}-Q${quarter}`,
    quarter,
    year,
    nameEn: `Q${quarter} ${year}`,
    nameTh: `ไตรมาส ${quarter} ปี ${year + 543}`,
    start,
    end,
    startIso: iso(start),
    endIso: iso(end),
    closesEn: formatDay(end, "en"),
    closesTh: formatDay(end, "th"),
    rangeEn: `${formatDay(start, "en")} – ${formatDay(end, "en")}`,
    rangeTh: `${formatDay(start, "th")} – ${formatDay(end, "th")}`,
    daysRemaining,
    elapsedPct,
  };
}

/** The four checkpoints shown on the admin cycle timeline. */
export function cycleMilestones(c: Cycle) {
  const monthStart = (offset: number) =>
    new Date(c.year, (c.quarter - 1) * 3 + offset, 1);
  return [
    { key: "launch", date: monthStart(0), en: "Launch", th: "เปิดรอบ" },
    { key: "mid", date: monthStart(1), en: "Mid-cycle", th: "กลางรอบ" },
    { key: "review", date: monthStart(2), en: "Manager review", th: "หัวหน้าประเมิน" },
    { key: "deadline", date: c.end, en: "Deadline", th: "ปิดรอบ" },
  ].map((m) => ({
    ...m,
    passed: m.date.getTime() <= Date.now(),
    current:
      m.date.getTime() <= Date.now() &&
      m.date.getMonth() === new Date().getMonth(),
  }));
}
