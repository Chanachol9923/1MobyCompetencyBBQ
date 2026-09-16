"use client";

import { Pill } from "@/components/ui";
import { VERDICT_LABEL, type GapVerdict } from "./gap";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TONE: Record<GapVerdict, "success" | "brand" | "warn" | "danger"> = {
  strength: "success",
  standard: "brand",
  development: "warn",
  critical: "danger",
};

/** Dot colours reuse the same tokens as the pill tones. */
export const VERDICT_DOT: Record<GapVerdict, string> = {
  strength: "bg-success",
  standard: "bg-brand",
  development: "bg-amber",
  critical: "bg-accent",
};

/** Hex for Recharts, straight off the token list. */
export const VERDICT_HEX: Record<GapVerdict, string> = {
  strength: "#00b916",
  standard: "#006bff",
  development: "#faa21b",
  critical: "#f05123",
};

/** Verdict wording in the active language, for CSV and generated sentences. */
export function useVerdictLabel() {
  const { lang } = useT();
  return (verdict: GapVerdict) => VERDICT_LABEL[verdict][lang];
}

export function VerdictPill({
  verdict,
  className,
  compact = false,
}: {
  verdict: GapVerdict;
  className?: string;
  compact?: boolean;
}) {
  const label = useVerdictLabel();
  return (
    <Pill
      tone={TONE[verdict]}
      className={cn(
        "whitespace-nowrap",
        compact && "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      {label(verdict)}
    </Pill>
  );
}

/**
 * The compact form of the verdict. A pill here would be a different width on
 * every row, which ragged-edges the progress bars sitting next to it - the dot
 * is fixed size, so every row lines up.
 */
export function VerdictDot({
  verdict,
  className,
}: {
  verdict: GapVerdict;
  className?: string;
}) {
  const label = useVerdictLabel();
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        VERDICT_DOT[verdict],
        className,
      )}
      title={label(verdict)}
      aria-label={label(verdict)}
      role="img"
    />
  );
}
