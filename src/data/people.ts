import { RAW_PEOPLE } from "./people.generated";
import { EXPECTED_BY_ROLE, expectedFor, isAssessed, type RoleName } from "./framework";

export type Role = "l1" | "l2" | "admin";

export type Person = {
  id: string;
  employeeId: string;
  name: string;
  nickname: string;
  /** job title shown under the name in the sidebar */
  title: string;
  level: string;
  grade: string;
  position: string;
  jobRole: string;
  department: string;
  division: string;
  businessUnit: string;
  reportTo: string;
  email: string;
  remark: string;
  /** official scores = manager assessment */
  scores: Record<string, number>;
  selfScores: Record<string, number>;
  managerScores: Record<string, number>;
  skillIndex: number;
  /** how far this person is through the current assessment cycle, 0-100 */
  phase: number;
  points: number;
  activity: string;
};

export type DemoAccount = {
  role: Role;
  personId: string;
  label: string;
};

/** deterministic pseudo-random so the demo looks alive but never shuffles */
function seeded(seed: string, min: number, max: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 1000) / 1000;
  return Math.round(min + unit * (max - min));
}

const ACTIVITY = [
  "Today",
  "2H Ago",
  "8H Ago",
  "Yesterday",
  "1H Ago",
  "12H Ago",
  "3H Ago",
  "1D Ago",
  "1W Ago",
  "18H Ago",
];

/** points shown in the Figma mocks, so those two screens still match */
const FIXED_POINTS: Record<string, number> = {
  boss: 8520,
  kengkra: 7850,
  michael: 7420,
  emma: 6980,
  david: 6540,
};

/** how far through the cycle each person is - a few are deliberately behind */
const FIXED_PHASE: Record<string, number> = {
  boss: 60,
  kengkra: 100,
  sarah: 12,
  david: 0,
  ilene: 10,
  emma: 25,
  deidra: 50,
};

function build(): Person[] {
  return RAW_PEOPLE.map((raw) => {
    const managerScores = { ...raw.managerScores } as Record<string, number>;
    const selfScores = { ...raw.selfScores } as Record<string, number>;
    const assessed = Object.keys(managerScores).filter((k) =>
      isAssessed(raw.jobRole, k),
    );
    const skillIndex = assessed.length
      ? Number(
          (
            assessed.reduce((a, k) => a + (managerScores[k] ?? 0), 0) /
            assessed.length
          ).toFixed(2),
        )
      : 0;
    return {
      id: raw.id,
      employeeId: raw.employeeId,
      name: raw.name,
      nickname: raw.nickname,
      title: raw.position,
      level: raw.level,
      grade: raw.grade,
      position: raw.position,
      jobRole: raw.jobRole,
      department: raw.department,
      division: raw.division,
      businessUnit: raw.businessUnit,
      reportTo: raw.reportTo,
      email: `${raw.id}@1moby.demo`,
      remark: "",
      scores: managerScores,
      selfScores,
      managerScores,
      skillIndex,
      phase: FIXED_PHASE[raw.id] ?? seeded(raw.employeeId + "p", 0, 100),
      points: FIXED_POINTS[raw.id] ?? seeded(raw.employeeId, 1800, 7200),
      activity: ACTIVITY[seeded(raw.employeeId + "a", 0, ACTIVITY.length - 1)]!,
    };
  });
}

const EMPLOYEES = build();

/** The admin persona is a system account, not part of the 22 headcount. */
export const ADMIN: Person = {
  id: "neo",
  employeeId: "808",
  name: "Neo",
  nickname: "Neo",
  title: "HROD (System Administrator)",
  level: "Admin",
  grade: "MG1",
  position: "HROD",
  jobRole: "Manager",
  department: "People & Organization Impact",
  division: "People Excellence",
  businessUnit: "People & Organization Impact",
  reportTo: "-",
  email: "neo@1moby.demo",
  remark: "System administrator account",
  scores: {},
  selfScores: {},
  managerScores: {},
  skillIndex: 0,
  phase: 100,
  points: 0,
  activity: "Now",
};

export const PEOPLE: Person[] = [...EMPLOYEES, ADMIN];

/** the 22 assessed employees, excluding the admin system account */
export const STAFF: Person[] = EMPLOYEES;

export const findPerson = (id: string) =>
  PEOPLE.find((p) => p.id === id) ?? ADMIN;

export const directReportsOf = (managerId: string) =>
  EMPLOYEES.filter((p) => p.reportTo === managerId);

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "l1", personId: "kengkra", label: "Login as Kengkra (Role L1)" },
  { role: "l2", personId: "boss", label: "Login as Boss (Role L2)" },
  { role: "admin", personId: "neo", label: "Login as Neo (Role Admin)" },
];

/** Boss Kitty's direct reports - drives Team Profile and manager review. */
export const TEAM_MEMBER_IDS = directReportsOf("boss").map((p) => p.id);

/** Which competency groups a role is assessed on, from the client's Map Level sheet. */
export function groupsForRole(jobRole: string) {
  const groups: ("core" | "functional" | "managerial")[] = ["core", "functional"];
  const row = EXPECTED_BY_ROLE[jobRole as RoleName];
  if (row && ["process", "purpose", "people", "result"].some((k) => row[k] != null)) {
    groups.push("managerial");
  }
  return groups;
}

export { expectedFor, isAssessed };

/* ------------------------------------------------------------ org structures */

function tally<T extends string>(values: T[]) {
  const map = new Map<T, number>();
  values.forEach((v) => map.set(v, (map.get(v) ?? 0) + 1));
  return map;
}

const deptCounts = tally(EMPLOYEES.map((p) => p.department));
const divCounts = tally(EMPLOYEES.map((p) => p.division));
const posCounts = tally(EMPLOYEES.map((p) => p.position));

function cycleStatus(progress: number) {
  if (progress >= 100) return "Complete";
  if (progress >= 60) return "On Track";
  return "Needs Follow-Up";
}

export const DEPARTMENTS = [...deptCounts.entries()].map(([name, employees], i) => {
  const members = EMPLOYEES.filter((p) => p.department === name);
  const done = members.filter((m) => m.phase >= 100).length;
  const progress = Math.round(
    members.reduce((a, m) => a + m.phase, 0) / Math.max(members.length, 1),
  );
  return {
    id: `d${i + 1}`,
    name,
    employees,
    assessed: `${done}/${employees}`,
    progress,
    status: cycleStatus(progress),
  };
});

export const DIVISIONS = [...divCounts.entries()].map(([name, employees], i) => ({
  id: `v${i + 1}`,
  name,
  department: EMPLOYEES.find((p) => p.division === name)!.department,
  employees,
}));

export const POSITIONS = [...posCounts.entries()].map(([name, headcount], i) => ({
  id: `p${i + 1}`,
  name,
  department: EMPLOYEES.find((p) => p.position === name)!.department,
  headcount,
}));

/** Career path from the 1Moby Careers chart in the requirement pack. */
export const JOB_ROLES = [
  { id: "r1", name: "Executive", level: "Level 1: Operation", grade: "EX1 - EX2", managerial: false },
  { id: "r2", name: "Senior", level: "Level 2: Senior Operation", grade: "SR1 - SR2", managerial: true },
  { id: "r3", name: "Specialist", level: "Level 2: Senior Operation", grade: "SP1 - SP2", managerial: true },
  { id: "r4", name: "Team Lead", level: "Level 3: Supervise", grade: "TL1 - TL2", managerial: true },
  { id: "r5", name: "Specialist Lead", level: "Level 3: Supervise", grade: "SL1 - SL2", managerial: true },
  { id: "r6", name: "Manager", level: "Level 4: Management", grade: "MG1 - MG2", managerial: true },
  { id: "r7", name: "Expertise", level: "Level 5: Strategy", grade: "EP1 - EP2", managerial: true },
  { id: "r8", name: "Director", level: "Level 5: Strategy", grade: "EP3 - EP4", managerial: true },
].map((r) => ({
  ...r,
  headcount: EMPLOYEES.filter((p) => p.jobRole === r.name).length,
}));

/** Grade ladder shown in the 1Moby Careers (New) chart. */
export const CAREER_LADDER = [
  { level: "6. Vision (C Level)", roles: ["C Suite"], grades: ["G11"] },
  { level: "5. Strategy", roles: ["Director", "Expertise"], grades: ["G09", "G10"] },
  { level: "4. Management", roles: ["Manager"], grades: ["G07", "G08"] },
  { level: "3. Supervise", roles: ["Team Lead", "Specialist Lead"], grades: ["G05", "G06"] },
  { level: "2. Senior Operation", roles: ["Senior", "Specialist"], grades: ["G03", "G04"] },
  { level: "1. Operation", roles: ["Executive"], grades: ["G01", "G02"] },
];
