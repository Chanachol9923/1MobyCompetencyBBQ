/**
 * The permission vocabulary. Roles are rows in the database and an admin can
 * re-point them at any time, but the *keys* are code: every server action and
 * page checks one of these, so they have to be a closed set the compiler knows.
 */
export const PERMISSIONS = {
  // own data
  SEE_OWN_RESULT: "see_own_result",
  RUN_SELF_ASSESSMENT: "run_self_assessment",
  WORK_OWN_IDP: "work_own_idp",
  TAKE_COURSES: "take_courses",
  REDEEM_REWARDS: "redeem_rewards",

  // team
  SEE_TEAM_RESULT: "see_team_result",
  REVIEW_DIRECT_REPORTS: "review_direct_reports",
  SET_TEAM_IDP_GOALS: "set_team_idp_goals",

  // organisation
  SEE_COMPANY_REPORT: "see_company_report",
  EXPORT_EMPLOYEE_LIST: "export_employee_list",

  // administration
  MANAGE_FRAMEWORK: "manage_framework",
  MANAGE_CYCLE: "manage_cycle",
  MANAGE_LMS: "manage_lms",
  MANAGE_REWARDS: "manage_rewards",
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  SEND_ANNOUNCEMENTS: "send_announcements",
  VIEW_AUDIT_LOG: "view_audit_log",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionMeta = {
  key: PermissionKey;
  nameEn: string;
  nameTh: string;
  category: "own" | "team" | "organisation" | "administration";
  descEn: string;
  descTh: string;
  /** the clause in the client requirement pack this comes from */
  source: string;
};

export const PERMISSION_CATALOGUE: PermissionMeta[] = [
  {
    key: PERMISSIONS.SEE_OWN_RESULT,
    nameEn: "See own result",
    nameTh: "ดูผลประเมินของตนเอง",
    category: "own",
    descEn: "Own scores, gaps, IDP and certificates.",
    descTh: "คะแนน ส่วนต่าง แผนพัฒนา และใบรับรองของตนเอง",
    source: "1.4",
  },
  {
    key: PERMISSIONS.RUN_SELF_ASSESSMENT,
    nameEn: "Run self assessment",
    nameTh: "ประเมินตนเอง",
    category: "own",
    descEn: "KPI plus the competencies their role is assessed on.",
    descTh: "KPI และสมรรถนะตามที่บทบาทของตนถูกประเมิน",
    source: "1.1",
  },
  {
    key: PERMISSIONS.WORK_OWN_IDP,
    nameEn: "Work on own IDP",
    nameTh: "ดำเนินการตามแผนพัฒนาของตนเอง",
    category: "own",
    descEn: "View the plan, progress it and attach evidence.",
    descTh: "ดูแผน ทำให้คืบหน้า และแนบหลักฐานการเรียนรู้",
    source: "2.2",
  },
  {
    key: PERMISSIONS.TAKE_COURSES,
    nameEn: "Take courses and earn certificates",
    nameTh: "เรียนหลักสูตรและรับใบรับรอง",
    category: "own",
    descEn: "Learning path, pre/post test, certificate.",
    descTh: "เส้นทางการเรียนรู้ ข้อสอบก่อน/หลัง และใบรับรอง",
    source: "3.1",
  },
  {
    key: PERMISSIONS.REDEEM_REWARDS,
    nameEn: "Collect points and redeem rewards",
    nameTh: "สะสมแต้มและแลกของรางวัล",
    category: "own",
    descEn: "Points, leaderboard and the reward catalogue.",
    descTh: "แต้มสะสม อันดับ และการแลกของรางวัล",
    source: "3.2",
  },
  {
    key: PERMISSIONS.SEE_TEAM_RESULT,
    nameEn: "See team results",
    nameTh: "ดูผลประเมินของทีม",
    category: "team",
    descEn: "Direct reports only, never the whole company.",
    descTh: "เฉพาะผู้ใต้บังคับบัญชาโดยตรง ไม่เห็นทั้งบริษัท",
    source: "1.4 / 2.1",
  },
  {
    key: PERMISSIONS.REVIEW_DIRECT_REPORTS,
    nameEn: "Review direct reports",
    nameTh: "ประเมินลูกทีม",
    category: "team",
    descEn: "The supervisor half of the 180° assessment.",
    descTh: "การประเมินในฐานะหัวหน้างาน",
    source: "Scope 1",
  },
  {
    key: PERMISSIONS.SET_TEAM_IDP_GOALS,
    nameEn: "Set development goals for the team",
    nameTh: "ตั้งเป้าหมายพัฒนาให้ลูกทีม",
    category: "team",
    descEn: "Pick a competency with a gap and set the timeline.",
    descTh: "เลือกสมรรถนะที่มีช่องว่างแล้วกำหนดช่วงเวลา",
    source: "2.2",
  },
  {
    key: PERMISSIONS.SEE_COMPANY_REPORT,
    nameEn: "See company report",
    nameTh: "ดูรายงานระดับองค์กร",
    category: "organisation",
    descEn: "Organisation-wide gap analysis and exports.",
    descTh: "รายงานวิเคราะห์ช่องว่างและการส่งออกระดับองค์กร",
    source: "1.4",
  },
  {
    key: PERMISSIONS.EXPORT_EMPLOYEE_LIST,
    nameEn: "Export employee list",
    nameTh: "ส่งออกรายชื่อพนักงาน",
    category: "organisation",
    descEn: "Manager scope is their own team only.",
    descTh: "หัวหน้างานส่งออกได้เฉพาะทีมของตน",
    source: "Scope 5",
  },
  {
    key: PERMISSIONS.MANAGE_FRAMEWORK,
    nameEn: "Manage competency framework",
    nameTh: "จัดการกรอบสมรรถนะ",
    category: "administration",
    descEn: "Competencies, expected levels and weighting.",
    descTh: "สมรรถนะ ระดับที่คาดหวัง และการถ่วงน้ำหนัก",
    source: "Scope 5",
  },
  {
    key: PERMISSIONS.MANAGE_CYCLE,
    nameEn: "Manage assessment cycle",
    nameTh: "จัดการรอบการประเมิน",
    category: "administration",
    descEn: "Cycle dates, reminders and completion tracking.",
    descTh: "ช่วงเวลารอบประเมิน การเตือน และการติดตาม",
    source: "Scope 5",
  },
  {
    key: PERMISSIONS.MANAGE_LMS,
    nameEn: "Manage LMS content library",
    nameTh: "จัดการคลังเนื้อหา LMS",
    category: "administration",
    descEn: "Courses, chapters and content types.",
    descTh: "หลักสูตร บทเรียน และประเภทเนื้อหา",
    source: "3.3",
  },
  {
    key: PERMISSIONS.MANAGE_REWARDS,
    nameEn: "Manage rewards and achievements",
    nameTh: "จัดการของรางวัลและความสำเร็จ",
    category: "administration",
    descEn: "Catalogue, stock, badges and redemptions.",
    descTh: "รายการของรางวัล สต๊อก เหรียญตรา และการแลกรับ",
    source: "3.2",
  },
  {
    key: PERMISSIONS.MANAGE_USERS,
    nameEn: "Manage users",
    nameTh: "จัดการผู้ใช้งาน",
    category: "administration",
    descEn: "Employees, org structure and account approval.",
    descTh: "พนักงาน โครงสร้างองค์กร และการอนุมัติบัญชี",
    source: "Scope 5",
  },
  {
    key: PERMISSIONS.MANAGE_ROLES,
    nameEn: "Manage roles and permissions",
    nameTh: "จัดการบทบาทและสิทธิ์",
    category: "administration",
    descEn: "Create roles and decide what each one can do.",
    descTh: "สร้างบทบาทและกำหนดว่าแต่ละบทบาททำอะไรได้",
    source: "Scope 5 / 7",
  },
  {
    key: PERMISSIONS.SEND_ANNOUNCEMENTS,
    nameEn: "Send announcements and reminders",
    nameTh: "ส่งประกาศและการแจ้งเตือน",
    category: "administration",
    descEn: "In-app and email notification rules.",
    descTh: "กฎการแจ้งเตือนในระบบและทางอีเมล",
    source: "3.4",
  },
  {
    key: PERMISSIONS.VIEW_AUDIT_LOG,
    nameEn: "View activity log and audit trail",
    nameTh: "ดูบันทึกกิจกรรมและร่องรอยการตรวจสอบ",
    category: "administration",
    descEn: "The full trail of who changed what.",
    descTh: "บันทึกทั้งหมดว่าใครแก้อะไร",
    source: "7",
  },
];

/** The three roles the system ships with, and what they can do out of the box. */
export const DEFAULT_ROLES: {
  key: string;
  nameEn: string;
  nameTh: string;
  description: string;
  sortOrder: number;
  permissions: PermissionKey[];
}[] = [
  {
    key: "employee",
    nameEn: "Employee",
    nameTh: "พนักงาน",
    description: "Individual contributor. Sees only their own result.",
    sortOrder: 1,
    permissions: [
      PERMISSIONS.SEE_OWN_RESULT,
      PERMISSIONS.RUN_SELF_ASSESSMENT,
      PERMISSIONS.WORK_OWN_IDP,
      PERMISSIONS.TAKE_COURSES,
      PERMISSIONS.REDEEM_REWARDS,
    ],
  },
  {
    key: "manager",
    nameEn: "Manager",
    nameTh: "หัวหน้างาน",
    description: "Has direct reports. Adds the team half of the product.",
    sortOrder: 2,
    permissions: [
      PERMISSIONS.SEE_OWN_RESULT,
      PERMISSIONS.RUN_SELF_ASSESSMENT,
      PERMISSIONS.WORK_OWN_IDP,
      PERMISSIONS.TAKE_COURSES,
      PERMISSIONS.REDEEM_REWARDS,
      PERMISSIONS.SEE_TEAM_RESULT,
      PERMISSIONS.REVIEW_DIRECT_REPORTS,
      PERMISSIONS.SET_TEAM_IDP_GOALS,
      PERMISSIONS.EXPORT_EMPLOYEE_LIST,
    ],
  },
  {
    key: "admin",
    nameEn: "Administrator",
    nameTh: "ผู้ดูแลระบบ",
    description: "HROD. Runs the framework; is not assessed.",
    sortOrder: 3,
    permissions: [
      PERMISSIONS.SEE_TEAM_RESULT,
      PERMISSIONS.SEE_COMPANY_REPORT,
      PERMISSIONS.EXPORT_EMPLOYEE_LIST,
      PERMISSIONS.MANAGE_FRAMEWORK,
      PERMISSIONS.MANAGE_CYCLE,
      PERMISSIONS.MANAGE_LMS,
      PERMISSIONS.MANAGE_REWARDS,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_ROLES,
      PERMISSIONS.SEND_ANNOUNCEMENTS,
      PERMISSIONS.VIEW_AUDIT_LOG,
    ],
  },
];

export function can(
  permissions: readonly string[] | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(permissions?.includes(key));
}

export function canAny(
  permissions: readonly string[] | undefined,
  keys: PermissionKey[],
): boolean {
  return keys.some((k) => can(permissions, k));
}
