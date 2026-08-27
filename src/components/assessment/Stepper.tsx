"use client";

import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type StepItem = { key: string; label: string };

/**
 * Figma stepper: label above a numbered circle, a rail that fills as the wizard
 * advances, "Progress" on the left and "n/m" on the right.
 */
export function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: StepItem[];
  current: number;
  onJump?: (index: number) => void;
}) {
  const { t } = useT();
  const n = Math.max(steps.length, 1);
  const fill = ((current + 0.5) / n) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t("label.progress")}</span>
        <span className="font-medium text-ink">
          {Math.min(current + 1, n)}/{n}
        </span>
      </div>

      <div className="relative mt-3 pb-1">
        <div className="absolute inset-x-0 bottom-[13px] h-[3px] rounded-full bg-line" />
        <div
          className="absolute bottom-[13px] left-0 h-[3px] rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${fill}%` }}
        />

        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {steps.map((s, i) => {
            const done = i < current;
            const active = i === current;
            const clickable = Boolean(onJump) && i <= current;
            return (
              <li key={s.key} className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump?.(i)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-md px-1 py-1 transition-colors sm:px-2",
                    clickable ? "cursor-pointer hover:bg-brand-tint/60" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "text-center text-[11px] font-bold leading-tight sm:text-sm",
                      active || done ? "text-brand" : "text-muted",
                    )}
                  >
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
                      done || active
                        ? "border-brand bg-brand text-white"
                        : "border-line-2 bg-white text-line-2",
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
