"use client";

import { heatColor } from "@/components/charts";
import { useT } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { definitionOf, nameOf } from "./gap";

export type HeatMember = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
};

export type HeatCompetency = {
  id: string;
  nameEn: string;
  nameTh: string | null;
  definitionEn: string | null;
  definitionTh: string | null;
};

/**
 * Team competency heat map: members down the side, competencies across the top.
 *
 * Built on CSS grid rather than a table so the whole matrix sizes itself to the
 * card — every member and every competency of the group are on screen at once
 * at desktop width, with no inner scrolling. Below `lg` the grid keeps a
 * sensible minimum width and the wrapper scrolls horizontally instead.
 *
 * `scoreOf` returns `null` when that person is not assessed on that competency —
 * the cell then reads "N/A" and is never coloured.
 */
export function HeatMapTable({
  members,
  competencies,
  scoreOf,
  expectedOf,
  selectedId,
  onSelect,
  maxHeight,
  className,
}: {
  members: HeatMember[];
  competencies: HeatCompetency[];
  scoreOf: (employeeId: string, competencyId: string) => number | null;
  expectedOf?: (employeeId: string, competencyId: string) => number | null;
  selectedId?: string | null;
  onSelect?: (employeeId: string) => void;
  /** optional cap; omit so the grid simply fits its container */
  maxHeight?: number;
  className?: string;
}) {
  const { t, tt, lang } = useT();

  /** Member column is a little wider than a score cell; the rest share evenly. */
  const columns = {
    gridTemplateColumns: `minmax(0,1.6fr) repeat(${Math.max(competencies.length, 1)}, minmax(0,1fr))`,
  };

  /**
   * Floor only — every column is `minmax(0,1fr)` so the grid expands to fill
   * whatever the card gives it. Kept small enough that a full group still fits
   * without scrolling at `lg`, where the sidebar eats 250px.
   */
  const minWidth = 140 + competencies.length * 46;

  return (
    <div
      className={cn("scroll-thin overflow-x-auto", className)}
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      <div
        role="table"
        aria-label={tt("Team competency heat map", "ฮีตแมปสมรรถนะของทีม")}
        className="min-w-0"
        style={{ minWidth }}
      >
        {/* ------------------------------------------------------- header */}
        <div role="row" className="grid gap-1" style={columns}>
          <span
            role="columnheader"
            className="flex items-end px-1 pb-1 text-[10px] leading-tight text-muted"
          >
            {t("label.member")}
          </span>
          {competencies.map((c) => (
            <span
              key={c.id}
              role="columnheader"
              title={`${nameOf(c, lang)} — ${definitionOf(c, lang) ?? ""}`}
              className="flex items-end justify-center px-0.5 pb-1 text-center text-[10px] font-medium leading-[1.2] text-muted"
            >
              <span className="line-clamp-2">{nameOf(c, lang)}</span>
            </span>
          ))}
        </div>

        {/* --------------------------------------------------------- rows */}
        <div className="mt-1 flex flex-col gap-1">
          {members.map((m) => {
            const active = selectedId === m.id;
            const cells = (
              <>
                <span className="flex min-w-0 items-center gap-2 pl-1 pr-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-line-2/60 text-[10px] font-bold text-white">
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[12px] font-bold leading-tight text-ink">
                      {m.nickname || m.name}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-muted">
                      {m.position ?? ""}
                    </span>
                  </span>
                </span>

                {competencies.map((c) => {
                  const score = scoreOf(m.id, c.id);
                  const name = nameOf(c, lang);
                  if (score == null) {
                    return (
                      <span
                        key={c.id}
                        role="cell"
                        title={tt(`${m.name} is not assessed on ${name}`,
                          `${m.name} ไม่ได้ประเมิน ${name}`,
                        )}
                        className="grid h-9 place-items-center rounded-md bg-surface text-[10px] text-muted"
                      >
                        {tt("N/A", "ไม่ประเมิน")}
                      </span>
                    );
                  }
                  const expected = expectedOf?.(m.id, c.id) ?? null;
                  return (
                    <span
                      key={c.id}
                      role="cell"
                      className="grid h-9 place-items-center rounded-md text-[13px] font-medium text-ink"
                      style={{ background: heatColor(score) }}
                      title={
                        expected != null
                          ? `${m.name} · ${name} — ${score} / ${t("label.expected")} ${expected}`
                          : `${m.name} · ${name} — ${score}`
                      }
                    >
                      {score}
                    </span>
                  );
                })}
              </>
            );

            const rowClass = cn(
              "grid w-full gap-1 rounded-md",
              onSelect && "cursor-pointer transition-colors hover:bg-surface/70",
              active && "outline outline-2 -outline-offset-1 outline-brand",
            );

            return onSelect ? (
              <button
                key={m.id}
                type="button"
                role="row"
                aria-current={active || undefined}
                onClick={() => onSelect(m.id)}
                className={rowClass}
                style={columns}
                title={m.name}
              >
                {cells}
              </button>
            ) : (
              <div
                key={m.id}
                role="row"
                className={rowClass}
                style={columns}
                title={m.name}
              >
                {cells}
              </div>
            );
          })}

          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {tt("No team members yet.", "ยังไม่มีสมาชิกในทีม")}
            </p>
          ) : null}
        </div>

        {/* -------------------------------------------------------- legend */}
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
          {[4, 3, 2, 1].map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: heatColor(s) }}
              />
              {s} · {t(`rating.${s}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-surface ring-1 ring-line" />
            {tt("Not assessed", "ไม่ประเมิน")}
          </li>
        </ul>
      </div>
    </div>
  );
}
