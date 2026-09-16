"use client";

import { Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import {
  STATUS_BAR,
  STATUS_TONE,
  barGeometry,
  goalStatus,
  monthTicks,
  parseDate,
  planWindow,
  type GoalStatus,
  type PlanGoal,
} from "./status";

export function useStatusLabel() {
  const { t, tt } = useT();
  return (s: GoalStatus) =>
    s === "complete"
      ? t("label.complete")
      : s === "overdue"
        ? t("status.overdue")
        : s === "atRisk"
          ? tt("At risk", "เสี่ยงล่าช้า")
          : t("status.onTrack");
}

export function StatusPill({ status }: { status: GoalStatus }) {
  const label = useStatusLabel();
  return <Pill tone={STATUS_TONE[status]}>{label(status)}</Pill>;
}

/** A goal on the strip: the dates, the derived percentage and a label. */
export type TimelineGoal = PlanGoal & { name: string };

/**
 * Gantt-ish strip across the whole plan period: one row per goal, the bar is
 * the goal's window and the solid fill inside it is its progress.
 *
 * The percentage arrives already derived from the server, so a goal backed by a
 * course follows that course's chapter completions without this component
 * knowing the LMS exists.
 */
export function GoalTimeline({
  goals,
  onSelect,
}: {
  goals: TimelineGoal[];
  onSelect?: (goalId: string) => void;
}) {
  const { tt, lang } = useT();
  const statusLabel = useStatusLabel();
  const now = Date.now();
  const win = planWindow(goals, now);
  const ticks = monthTicks(win);
  const span = Math.max(win.end - win.start, 1);
  const todayAt = Math.max(0, Math.min(100, ((now - win.start) / span) * 100));
  const locale = lang === "th" ? "th-TH" : "en-GB";

  const fmt = (iso: string) =>
    new Date(parseDate(iso)).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });

  if (!goals.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        {tt("No goals to plot yet.", "ยังไม่มีเป้าหมายให้แสดงบนไทม์ไลน์")}
      </p>
    );
  }

  return (
    <div className="scroll-thin overflow-x-auto">
      <div className="min-w-[640px]">
        {/* month scale */}
        <div className="relative mb-2 ml-[190px] h-5 border-b border-line/70">
          {ticks.map((tick) => (
            <span
              key={tick.at}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted"
              style={{ left: `${tick.at}%` }}
            >
              {tick.label.toLocaleDateString(locale, {
                month: "short",
                year: "2-digit",
              })}
            </span>
          ))}
        </div>

        <ul className="space-y-2">
          {goals.map((g) => {
            const status = goalStatus(g, now);
            const geo = barGeometry(g, win);
            const Row = onSelect ? "button" : "div";
            return (
              <li key={g.id}>
                <Row
                  {...(onSelect
                    ? { type: "button" as const, onClick: () => onSelect(g.id) }
                    : {})}
                  className={`flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left ${
                    onSelect ? "transition-colors hover:bg-surface" : ""
                  }`}
                >
                  <span className="w-[182px] shrink-0">
                    <span className="block truncate text-[13px] font-bold text-ink">
                      {g.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {fmt(g.startDate)} → {fmt(g.dueDate)}
                    </span>
                  </span>

                  <span className="relative h-7 min-w-0 flex-1 rounded-md bg-surface">
                    {/* today marker */}
                    <span
                      className="absolute inset-y-0 z-10 w-px bg-ink/40"
                      style={{ left: `${todayAt}%` }}
                      title={tt("Today", "วันนี้")}
                    />
                    <span
                      className="absolute inset-y-1 overflow-hidden rounded-[5px] bg-line-2/40"
                      style={{ left: `${geo.left}%`, width: `${geo.width}%` }}
                      title={`${g.name} · ${statusLabel(status)} · ${g.progress}%`}
                    >
                      <span
                        className={`block h-full rounded-[5px] ${STATUS_BAR[status]}`}
                        style={{ width: `${Math.min(100, g.progress)}%` }}
                      />
                    </span>
                  </span>

                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
                    {g.progress}%
                  </span>
                </Row>
              </li>
            );
          })}
        </ul>

        {/* legend */}
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
          {(["onTrack", "atRisk", "overdue", "complete"] as GoalStatus[]).map(
            (s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-sm ${STATUS_BAR[s]}`} />
                {statusLabel(s)}
              </li>
            ),
          )}
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-ink/40" />
            {tt("Today", "วันนี้")}
          </li>
        </ul>
      </div>
    </div>
  );
}
