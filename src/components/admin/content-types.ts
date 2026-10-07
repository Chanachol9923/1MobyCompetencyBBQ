/**
 * The shapes the content-administration screens exchange with the server —
 * rewards, badges, the organisation, the course library, the assessment cycle
 * and the overview.
 *
 * They live here rather than in `src/server/admin-content.ts` because that
 * module carries `"use server"` and a `"use server"` file may only export async
 * functions. The server never picks a language: it hands both columns down and
 * the client chooses with `useT()`.
 */

import type { ActionResult, Bilingual } from "@/components/admin/admin-types";

export type { ActionResult, Bilingual };

export type PublishStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type RedemptionStatusValue = "PREPARING" | "DELIVERED" | "CANCELLED";
export type CompetencyGroupValue = "CORE" | "FUNCTIONAL" | "MANAGERIAL";
export type ChapterKindValue = "VIDEO" | "PDF" | "ARTICLE";
export type CycleStatusValue = "DRAFT" | "OPEN" | "REVIEW" | "CLOSED";

/* ==========================================================  /admin/reward */

export type AdminRewardRow = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string | null;
  points: number;
  stock: number;
  tone: string | null;
  image: string | null;
  active: boolean;
  /** redemptions that were not cancelled */
  redeemedCount: number;
  /** redemptions still waiting to be handed over */
  preparingCount: number;
};

export type RedemptionQueueRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  rewardId: string;
  rewardNameEn: string;
  rewardNameTh: string | null;
  points: number;
  status: RedemptionStatusValue;
  /** ISO timestamp */
  createdAt: string;
};

export type RewardAdminData = {
  rewards: AdminRewardRow[];
  queue: RedemptionQueueRow[];
  counts: {
    total: number;
    active: number;
    inStock: number;
    redeemed: number;
    preparing: number;
    pointsSpent: number;
  };
};

/* ====================================================  /admin/achievements */

export type BadgeHolder = {
  employeeId: string;
  name: string;
  employeeCode: string;
  /** ISO timestamp */
  earnedAt: string;
};

export type AdminBadgeRow = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string | null;
  requirementEn: string | null;
  requirementTh: string | null;
  points: number;
  tone: string | null;
  /** courses | certificates | assessments | paths | manual */
  source: string;
  target: number | null;
  active: boolean;
  holderCount: number;
  holders: BadgeHolder[];
};

export type EmployeeOptionRow = {
  id: string;
  name: string;
  employeeCode: string;
  departmentName: string | null;
};

export type BadgeAdminData = {
  badges: AdminBadgeRow[];
  /** everyone a badge can be granted to */
  employees: EmployeeOptionRow[];
  counts: { total: number; active: number; awarded: number };
};

/* =================================================================  /admin */

/** The open cycle as the overview and the cycle editor both see it. */
export type CycleSummary = {
  id: string;
  key: string;
  nameEn: string;
  nameTh: string;
  /** ISO date, `YYYY-MM-DD` */
  startsAt: string;
  endsAt: string;
  status: CycleStatusValue;
  weightKpi: number;
  weightCore: number;
  weightFunctional: number;
  weightManagerial: number;
  /** whole days from today to `endsAt`, floored at zero */
  daysRemaining: number;
};

/**
 * One person on the overview. Every number here is derived from the framework
 * and the cycle's scores — none of them is a stored column.
 */
export type OverviewEmployeeRow = {
  id: string;
  employeeCode: string;
  name: string;
  nickname: string | null;
  email: string;
  jobRoleName: string;
  level: string;
  positionName: string | null;
  departmentName: string | null;
  divisionName: string | null;
  businessUnit: string | null;
  grade: string | null;
  remark: string | null;
  managerName: string | null;
  /** average of the scores this person's role is assessed on, 0 when unscored */
  skillIndex: number;
  /** how much of this cycle's assessment is done, 0-100 */
  phase: number;
  /** competencies this person's career role is assessed on at all */
  assessedCount: number;
  points: number;
  selfSubmitted: boolean;
  supervisorSubmitted: boolean;
};

export type DepartmentProgressRow = {
  id: string;
  name: string;
  headcount: number;
  /** how many of them have a complete set of scores */
  assessed: number;
  progress: number;
  status: "complete" | "on-track" | "follow-up";
};

export type ActivityFeedRow = {
  id: string;
  actorLabel: string;
  action: string;
  targetLabel: string | null;
  /** ISO timestamp */
  createdAt: string;
};

/* ======================================================  /admin/assessment */

export type MatrixJobRole = {
  id: string;
  name: string;
  level: string;
  levelRank: number;
  employeeCount: number;
};

export type CompetencyLevelRow = {
  score: number;
  labelEn: string;
  labelTh: string;
  descEn: string | null;
  descTh: string | null;
};

export type MatrixCompetency = {
  id: string;
  key: string;
  group: CompetencyGroupValue;
  nameEn: string;
  nameTh: string | null;
  definitionEn: string | null;
  definitionTh: string | null;
  levels: CompetencyLevelRow[];
};

/** One person's standing in the open cycle. */
export type CycleStatusRow = {
  id: string;
  name: string;
  jobRoleName: string;
  level: string;
  departmentName: string | null;
  assessedCount: number;
  phase: number;
  selfSubmitted: boolean;
  supervisorSubmitted: boolean;
};

export type AssessmentAdminData = {
  cycle: CycleSummary | null;
  jobRoles: MatrixJobRole[];
  competencies: MatrixCompetency[];
  /**
   * `"<jobRoleId>:<competencyId>"` → expected level. A key that is absent, or
   * present with `null`, both mean the same thing: that career role is **not
   * assessed** on that competency and it never appears in their gap report.
   */
  matrix: Record<string, number | null>;
  /**
   * Same key → how many people in that career role already carry a score for
   * that competency in the open cycle. This is the blast radius of a change.
   */
  scored: Record<string, number>;
  employees: CycleStatusRow[];
  counts: {
    headcount: number;
    selfSubmitted: number;
    supervisorSubmitted: number;
    assessedCells: number;
    notAssessedCells: number;
  };
};

/** What changing one matrix cell actually did, so the screen can say so. */
export type ExpectedLevelOutcome = {
  jobRoleName: string;
  competencyNameEn: string;
  competencyNameTh: string | null;
  from: number | null;
  to: number | null;
  employeesAffected: number;
  scoresOrphaned: number;
};

/**
 * The same shape every other action answers with — so the shared `ResultBanner`
 * renders it — plus what the change did, for the screen's own accounting.
 */
export type ExpectedLevelResult =
  | { ok: true; message: Bilingual; outcome: ExpectedLevelOutcome }
  | { ok: false; error: Bilingual };

/* =============================================================  /admin/lms */

export type AdminChapterRow = {
  id: string;
  sortOrder: number;
  kind: ChapterKindValue;
  titleEn: string;
  titleTh: string | null;
  summaryEn: string | null;
  summaryTh: string | null;
  minutes: number;
  pages: number | null;
  /** the uploaded video or PDF, when there is one */
  mediaUrl: string | null;
  mediaBytes: number | null;
};

export type AdminCourseRow = {
  id: string;
  slug: string;
  titleEn: string;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  category: CompetencyGroupValue;
  competencyId: string | null;
  competencyName: string | null;
  competencyNameTh: string | null;
  hours: number;
  cover: string | null;
  status: PublishStatusValue;
  chapters: AdminChapterRow[];
  enrolledCount: number;
  completedCount: number;
  certificateCount: number;
  /** learning paths that include this course as a step */
  pathStepCount: number;
};

export type CompetencyOption = {
  id: string;
  key: string;
  group: CompetencyGroupValue;
  nameEn: string;
  nameTh: string | null;
};

export type LmsAdminData = {
  courses: AdminCourseRow[];
  competencies: CompetencyOption[];
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    chapters: number;
    taggedCompetencies: number;
  };
};

/* ========================================================  /admin/employee */

/** The requirement pack's Data Set, one row per person. */
export type AdminEmployeeRow = {
  id: string;
  employeeCode: string;
  name: string;
  nickname: string | null;
  email: string;
  grade: string | null;
  businessUnit: string | null;
  remark: string | null;
  active: boolean;
  jobRoleId: string;
  jobRoleName: string;
  /** the career level the job role carries, e.g. "Level 3: Supervise" */
  level: string;
  departmentId: string | null;
  departmentName: string | null;
  divisionId: string | null;
  divisionName: string | null;
  positionId: string | null;
  positionName: string | null;
  managerId: string | null;
  managerName: string | null;
  /** true when a login account is linked to this person */
  hasLogin: boolean;
  reportCount: number;
};

export type OrgEntity = "department" | "division" | "position";

/** A department, division or position — everything shares the same shape. */
export type OrgUnitRow = {
  id: string;
  name: string;
  /** the department a division or position belongs to, when it has one */
  parentId: string | null;
  parentName: string | null;
  employeeCount: number;
  /** divisions under a department; always 0 for the other two */
  childCount: number;
};

export type JobRoleRow = {
  id: string;
  key: string;
  name: string;
  level: string;
  levelRank: number;
  gradeFrom: string;
  gradeTo: string;
  employeeCount: number;
  /** competencies this career role is assessed on (a non-null expected level) */
  assessedCount: number;
};

export type EmployeeAdminData = {
  employees: AdminEmployeeRow[];
  departments: OrgUnitRow[];
  divisions: OrgUnitRow[];
  positions: OrgUnitRow[];
  jobRoles: JobRoleRow[];
  counts: { active: number; inactive: number; withLogin: number };
};

export type AdminOverviewData = {
  cycle: CycleSummary | null;
  counts: {
    headcount: number;
    selfSubmitted: number;
    supervisorSubmitted: number;
    certificates: number;
  };
  departments: DepartmentProgressRow[];
  employees: OverviewEmployeeRow[];
  activity: ActivityFeedRow[];
};
