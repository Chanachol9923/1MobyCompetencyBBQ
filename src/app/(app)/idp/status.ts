/**
 * Goal status and the geometry of the timeline strip.
 *
 * Nothing here reads a store or a database: a goal arrives as three facts —
 * when it started, when it is due, and how far along it is — and the status is
 * derived from them every time it is asked for. The percentage itself is
 * computed once on the server (`getGoalRows` in `src/server/team.ts`, which
 * reads a course-backed goal off the learner's chapter completions), so a
 * course finished on another device moves this screen without anything being
 * written twice.
 */

/** The three fields every helper below needs. */
export type PlanGoal = {
  id: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  dueDate: string;
  /** 0-100, already derived */
  progress: number;
};

export type GoalStatus = "complete" | "overdue" | "atRisk" | "onTrack";

const day = 864e5;

export const parseDate = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.now() : t;
};

/**
 * Status is derived, never stored: a goal is late once today is past the due
 * date, and "at risk" when progress trails the share of the window already
 * spent by more than 15 points.
 */
export function goalStatus(goal: PlanGoal, now = Date.now()): GoalStatus {
  if (goal.progress >= 100) return "complete";
  const start = parseDate(goal.startDate);
  const due = parseDate(goal.dueDate);
  if (now > due) return "overdue";
  const span = Math.max(due - start, day);
  const elapsed = Math.min(Math.max(now - start, 0), span);
  const expected = (elapsed / span) * 100;
  return goal.progress + 15 < expected ? "atRisk" : "onTrack";
}

/** Whole days left before the due date; negative when overdue. */
export function daysLeft(goal: PlanGoal, now = Date.now()) {
  return Math.ceil((parseDate(goal.dueDate) - now) / day);
}

export const STATUS_TONE: Record<
  GoalStatus,
  "success" | "brand" | "warn" | "danger"
> = {
  complete: "success",
  onTrack: "brand",
  atRisk: "warn",
  overdue: "danger",
};

export const STATUS_BAR: Record<GoalStatus, string> = {
  complete: "bg-success",
  onTrack: "bg-brand",
  atRisk: "bg-amber",
  overdue: "bg-accent",
};

/** Plan window covering every goal, padded so today always fits on screen. */
export function planWindow(goals: PlanGoal[], now = Date.now()) {
  if (!goals.length) return { start: now, end: now + 90 * day };
  const starts = goals.map((g) => parseDate(g.startDate));
  const ends = goals.map((g) => parseDate(g.dueDate));
  const start = Math.min(...starts, now);
  const end = Math.max(...ends, now);
  const span = Math.max(end - start, 30 * day);
  return { start, end: start + span };
}

/** Percentage offsets for a goal's bar inside the plan window. */
export function barGeometry(
  goal: PlanGoal,
  win: { start: number; end: number },
) {
  const span = Math.max(win.end - win.start, 1);
  const start = parseDate(goal.startDate);
  const due = parseDate(goal.dueDate);
  const left = ((start - win.start) / span) * 100;
  const width = Math.max(((due - start) / span) * 100, 2);
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(2, Math.min(100 - Math.max(0, left), width)),
  };
}

/** First-of-month ticks across the plan window, capped so labels stay legible. */
export function monthTicks(win: { start: number; end: number }) {
  const ticks: { at: number; label: Date }[] = [];
  const cursor = new Date(win.start);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const span = Math.max(win.end - win.start, 1);
  for (let i = 0; i < 36; i++) {
    const t = cursor.getTime();
    if (t > win.end) break;
    if (t >= win.start) {
      ticks.push({ at: ((t - win.start) / span) * 100, label: new Date(t) });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const step = Math.ceil(ticks.length / 8) || 1;
  return ticks.filter((_, i) => i % step === 0);
}
