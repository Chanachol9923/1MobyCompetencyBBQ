/**
 * View models for `/achievements` — leaderboard, certificates and badges.
 *
 * Kept out of `src/server/engagement.ts` for the same reason as the reward
 * types: a `"use server"` module may only export async functions.
 */

/** Where a badge's progress is measured from. Mirrors `Badge.source`. */
export type BadgeSourceValue =
  | "courses"
  | "certificates"
  | "assessments"
  | "paths"
  | "manual";

export type LeaderRow = {
  rank: number;
  employeeId: string;
  name: string;
  position: string | null;
  points: number;
  isViewer: boolean;
};

export type CertificateCard = {
  id: string;
  code: string;
  titleEn: string;
  titleTh: string | null;
  holderName: string;
  isMine: boolean;
  score: number | null;
  /** ISO timestamp */
  issuedAt: string;
  kind: "COURSE" | "PATH" | "OTHER";
};

export type BadgeCard = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string | null;
  requirementEn: string | null;
  requirementTh: string | null;
  tone: string | null;
  points: number;
  source: BadgeSourceValue;
  /** null for a manual badge — there is no counter to measure it against */
  target: number | null;
  earned: boolean;
  /** set only when the badge was awarded as an `EmployeeBadge` row */
  earnedAt: string | null;
  /** the live counter behind this badge, null when the badge is manual */
  current: number | null;
};

/** The four counters the badges derive from, shown to explain the progress. */
export type LiveCounters = {
  coursesCompleted: number;
  certificatesEarned: number;
  assessmentsSubmitted: number;
  pathsFinished: number;
  pathsAvailable: number;
};

export type AchievementsScreenData = {
  board: LeaderRow[];
  /** the viewer's own row, even when it falls outside the visible board */
  viewerRow: LeaderRow | null;
  certificates: CertificateCard[];
  myCertificateCount: number;
  /** own + direct reports', and only when the viewer may see the team at all */
  visibleCertificateCount: number;
  canSeeTeamCertificates: boolean;
  badges: BadgeCard[];
  counters: LiveCounters;
};
