"use client";

import { useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  LEVEL_DESC_EN,
  parseBehavior,
  pick,
  type CompetencyQuestion,
  type LevelDetail,
} from "./lib";

/* --------------------------------------------------------------- one box */

/**
 * One rating option, carrying that level's own description straight from
 * `CompetencyLevel`. The Thai behaviour text holds a `ตัวอย่าง:` worked example,
 * which stays behind a disclosure so the four boxes remain scannable.
 */
function LevelBox({
  level,
  selected,
  expected,
  indicators,
  readOnly,
  onSelect,
}: {
  level: LevelDetail | undefined;
  selected: boolean;
  expected: boolean;
  indicators: string[];
  readOnly: boolean;
  onSelect: () => void;
}) {
  const { t, tt, lang } = useT();
  const [open, setOpen] = useState(false);

  const score = level?.score ?? 0;
  const label = pick(lang, level?.labelEn || t(`rating.${score}`), level?.labelTh);
  const description = pick(
    lang,
    level?.descEn || LEVEL_DESC_EN[score] || "",
    level?.descTh,
  );

  const thai = parseBehavior(level?.behaviorTh ?? null);
  const english = parseBehavior(level?.behaviorEn ?? null);
  const source = lang === "th" ? thai : english;
  // English has no behaviour text in the workbook — fall back to the Thai
  // worked example and the competency's own English indicators
  const bullets = source.bullets.length
    ? source.bullets
    : lang === "th"
      ? []
      : indicators;
  const example = source.example || thai.example;
  const hasDisclosure = bullets.length > 0 || Boolean(example);

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
        disabled={readOnly}
        onClick={onSelect}
        className={cn(
          "flex flex-1 flex-col items-center gap-1.5 rounded-t-lg px-3 pb-3 pt-5 text-left",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          readOnly && "cursor-default",
        )}
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
            className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-brand hover:text-brand-dark max-lg:min-h-11"
          >
            <span>{tt("See example", "ดูตัวอย่าง")}</span>
            <ChevronDown
              size={13}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="mt-2 space-y-2">
              {bullets.length ? (
                <ul className="list-disc space-y-1 pl-4 text-[11px] font-light leading-relaxed text-muted">
                  {bullets.map((b, i) => (
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
  value,
  onChange,
  readOnly = false,
}: {
  index: number;
  competency: CompetencyQuestion;
  value?: number;
  onChange: (rating: number) => void;
  readOnly?: boolean;
}) {
  const { t, tt, lang } = useT();
  const name = pick(lang, competency.nameEn, competency.nameTh);
  const definition = pick(
    lang,
    competency.definitionEn ?? "",
    competency.definitionTh,
  );

  return (
    <Card className="p-5 lg:p-6">
      <div className="flex gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-medium text-white">
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold text-ink">{name}</h3>
            <span className="text-xs text-muted">
              {t("label.expected")}:{" "}
              <b className="text-ink">{competency.expected}</b> / 4
            </span>
          </div>

          {definition ? (
            <p className="mt-1 break-words text-sm leading-relaxed text-muted">
              {definition}
            </p>
          ) : null}

          {lang === "th" && competency.subTh ? (
            <p className="mt-1 break-words text-xs leading-relaxed text-line-2">
              {competency.subTh}
            </p>
          ) : null}

          {lang === "en" && competency.indicatorsEn.length ? (
            <>
              <p className="mt-4 text-sm font-medium text-ink">
                {tt("Behavioral indicators:", "พฤติกรรมบ่งชี้:")}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-light leading-relaxed text-muted">
                {competency.indicatorsEn.map((ind) => (
                  <li key={ind}>{ind}</li>
                ))}
              </ul>
            </>
          ) : null}

          <fieldset className="mt-6">
            <legend className="sr-only">
              {tt(
                `Rate ${name} from 1 to 4`,
                `ให้คะแนน ${name} ตั้งแต่ 1 ถึง 4`,
              )}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((score) => (
                <LevelBox
                  key={score}
                  level={
                    competency.levels.find((l) => l.score === score) ?? {
                      score,
                      labelEn: "",
                      labelTh: "",
                      descEn: null,
                      descTh: null,
                      behaviorEn: null,
                      behaviorTh: null,
                    }
                  }
                  selected={value === score}
                  expected={competency.expected === score}
                  indicators={competency.indicatorsEn}
                  readOnly={readOnly}
                  onSelect={() => !readOnly && onChange(score)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </Card>
  );
}
