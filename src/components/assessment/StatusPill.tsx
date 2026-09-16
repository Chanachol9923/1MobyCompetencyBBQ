"use client";

import { Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { STATUS_DICT_KEY, type AssessmentStatus } from "./lib";

const TONE: Record<AssessmentStatus, "neutral" | "warn" | "success"> = {
  "not-started": "neutral",
  "in-progress": "warn",
  submitted: "success",
};

export function StatusPill({ status }: { status: AssessmentStatus }) {
  const { t } = useT();
  return <Pill tone={TONE[status]}>{t(STATUS_DICT_KEY[status])}</Pill>;
}

/**
 * The gap verdict wording lives with the rest of the converted gap engine in
 * `components/profile` — re-exported here so the assessment screens have one
 * import rather than two, and so there is still only one copy of the labels.
 */
export { VerdictPill } from "@/components/profile/VerdictPill";
