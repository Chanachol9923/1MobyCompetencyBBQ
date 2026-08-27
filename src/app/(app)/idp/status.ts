import type { IdpGoal } from "@/lib/store";

export type GoalStatus = "complete" | "overdue" | "atRisk" | "onTrack";

const day = 864e5;

export const parseDate = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.now() : t;
};

/**
 * Status is derived, never stored: a goal is late if today is past the due
 * date, and "at risk" when progress trails the share of the window already
 * spent by more than 15 points.
 *
 * `progress` is the live number — callers that have the store pass
 * `goalProgress(state, goal)` so a goal backed by a course follows the course.
 * Completion is derived from that number, never from the stored `complete`
 * flag, which is only a seed value.
 */
export function goalStatus(
  goal: IdpGoal,
  progress: number = goal.progress,
  now = Date.now(),
): GoalStatus {
  if (progress >= 100) return "complete";
  const start = parseDate(goal.startDate);
  const due = parseDate(goal.dueDate);
  if (now > due) return "overdue";
  const span = Math.max(due - start, day);
  const elapsed = Math.min(Math.max(now - start, 0), span);
  const expected = (elapsed / span) * 100;
  return progress + 15 < expected ? "atRisk" : "onTrack";
}

/** Whole days left before the due date; negative when overdue. */
export function daysLeft(goal: IdpGoal, now = Date.now()) {
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
export function planWindow(goals: IdpGoal[], now = Date.now()) {
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
  goal: IdpGoal,
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
