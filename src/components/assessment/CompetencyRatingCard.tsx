"use client";

import { useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RATING_LABELS, type Competency } from "@/data/competencies";
import {
  LEVEL_DESC_EN,
  levelsFor,
  parseBehavior,
  subTitleTh,
} from "./lib";

/* --------------------------------------------------------------- one box */

function LevelBox({
  competencyId,
  score,
  selected,
  expected,
  indicators,
  onSelect,
}: {
  competencyId: string;
  score: number;
  selected: boolean;
  expected: boolean;
  indicators: string[];
  onSelect: () => void;
}) {
  const { tt, lang } = useT();
  const [open, setOpen] = useState(false);

  const level = levelsFor(competencyId).find((l) => l.score === score);
  const label =
    lang === "th"
      ? level?.labelTh || RATING_LABELS[score]
      : RATING_LABELS[score];
  const description =
    lang === "th"
      ? level?.descTh || ""
      : LEVEL_DESC_EN[score] || "";

  const { bullets, example } = parseBehavior(level?.behaviorTh ?? "");
  const behaviourList = lang === "th" ? bullets : bullets.length ? bullets : indicators;
  const hasDisclosure = behaviourList.length > 0 || Boolean(example);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border transition-all",
        selected
          ? "border-brand bg-brand-tint/60 shadow-[0_0_0_1px_var(--color-brand)]"
          : "border-line bg-white hover:border-line-2",
      )}
    >
      {expected ? (
        <span className="absolute -top-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-amber/50 bg-amber/15 px-2 py-0.5 text-[10px] font-bold text-[#b57408]">
          <Target size={10} strokeWidth={2.5} />
          {tt("Expected", "ระดับที่คาดหวัง")}
        </span>
      ) : null}

      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex flex-1 flex-col items-center gap-1.5 rounded-t-lg px-3 pb-3 pt-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span
          className={cn(
            "text-3xl font-medium leading-none",
            selected ? "text-brand" : "text-ink",
          )}
        >
          {score}
        </span>
        <span
          className={cn(
            "w-full text-center text-xs font-bold leading-snug",
            selected ? "text-brand" : "text-ink",
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-1 block w-full whitespace-pre-line break-words text-left text-[11px] font-light leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </button>

      {hasDisclosure ? (
        <div className="border-t border-line/70 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-brand hover:text-brand-dark"
          >
            <span>{tt("See example", "ดูตัวอย่าง")}</span>
            <ChevronDown
              size={13}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="mt-2 space-y-2">
              {behaviourList.length ? (
                <ul className="list-disc space-y-1 pl-4 text-[11px] font-light leading-relaxed text-muted">
                  {behaviourList.map((b, i) => (
                    <li key={i} className="break-words">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              {example ? (
                <div className="rounded-md bg-surface px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {tt("Example", "ตัวอย่าง")}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-[11px] font-light leading-relaxed text-ink">
                    {example}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- the card */

export function CompetencyRatingCard({
  index,
  competency,
  expected,
  value,
  onChange,
  readOnly = false,
}: {
  index: number;
  competency: Competency;
  expected: number | null;
  value?: number;
  onChange: (rating: number) => void;
  readOnly?: boolean;
}) {
  const { t, tt, lang } = useT();
  const sub = subTitleTh(competency.id);

  return (
    <Card className="p-5 lg:p-6">
      <div className="flex gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-medium text-white">
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold text-ink">{competency.name}</h3>
            {expected !== null ? (
              <span className="text-xs text-muted">
                {t("label.expected")}: <b className="text-ink">{expected}</b> / 4
              </span>
            ) : null}
          </div>

          <p className="mt-1 break-words text-sm leading-relaxed text-muted">
            {lang === "th" ? competency.definitionTh : competency.definition}
          </p>

          {lang === "th" && sub ? (
            <p className="mt-1 break-words text-xs leading-relaxed text-line-2">
              {sub}
            </p>
          ) : null}

          {lang === "en" && competency.indicators.length ? (
            <>
              <p className="mt-4 text-sm font-medium text-ink">
                {tt("Behavioral Indicators:", "พฤติกรรมบ่งชี้:")}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-light leading-relaxed text-muted">
                {competency.indicators.map((ind) => (
                  <li key={ind}>{ind}</li>
                ))}
              </ul>
            </>
          ) : null}

          <fieldset className="mt-6" disabled={readOnly}>
            <legend className="sr-only">
              {tt(
                `Rate ${competency.name} from 1 to 4`,
                `ให้คะแนน ${competency.name} ตั้งแต่ 1 ถึง 4`,
              )}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((r) => (
                <LevelBox
                  key={r}
                  competencyId={competency.id}
                  score={r}
                  selected={value === r}
                  expected={expected === r}
                  indicators={competency.indicators}
                  onSelect={() => !readOnly && onChange(r)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </Card>
  );
}
