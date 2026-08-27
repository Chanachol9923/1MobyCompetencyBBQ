"use client";

import { Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { GAP_VERDICT_LABEL, type GapVerdict } from "@/data/competencies";
import { STATUS_KEY, type Status } from "./lib";

const TONE: Record<Status, "neutral" | "warn" | "success"> = {
  "not-started": "neutral",
  "in-progress": "warn",
  submitted: "success",
};

export function StatusPill({ status }: { status: Status }) {
  const { t } = useT();
  return <Pill tone={TONE[status]}>{t(STATUS_KEY[status])}</Pill>;
}

const VERDICT_TONE: Record<GapVerdict, "success" | "brand" | "warn" | "danger"> = {
  strength: "success",
  standard: "brand",
  development: "warn",
  critical: "danger",
};

export function VerdictPill({ verdict }: { verdict: GapVerdict }) {
  const { lang } = useT();
  return (
    <Pill tone={VERDICT_TONE[verdict]}>{GAP_VERDICT_LABEL[verdict][lang]}</Pill>
  );
}

export { VERDICT_TONE };
