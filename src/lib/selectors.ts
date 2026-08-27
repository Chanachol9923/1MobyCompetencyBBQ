import { goalProgress, type DemoState } from "@/lib/store";

/**
 * Gap and score maths lives in `src/components/profile/gap.ts`, which respects
 * the client's expected-level matrix (a competency a role is not assessed on is
 * absent, never a zero). Only genuinely score-independent helpers belong here.
 */

export function idpProgress(state: DemoState, personId: string) {
  const goals = state.idp[personId] ?? [];
  if (!goals.length) return 0;
  // course-backed goals take their progress from the LMS, so read through the
  // same helper the plan itself uses rather than the stored number
  const sum = goals.reduce((a, g) => a + goalProgress(state, g), 0);
  return Math.round(sum / goals.length);
}

export function assessmentDone(state: DemoState, personId: string) {
  return Boolean(state.selfAssessment[personId]?.submittedAt);
}
