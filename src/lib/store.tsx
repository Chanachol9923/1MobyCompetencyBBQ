"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_ACCOUNTS,
  PEOPLE,
  findPerson,
  type Person,
  type Role,
} from "@/data/people";
import {
  COMPETENCIES,
  expectedFor,
  isAssessed,
  type Group,
} from "@/data/competencies";
import {
  ACHIEVEMENTS,
  ANNOUNCEMENTS,
  COURSES,
  REWARDS,
  type Achievement,
  type Announcement,
  type Course,
  type Reward,
} from "@/data/learning";

const STORAGE_KEY = "1moby-demo-state-v3";

export type IdpGoal = {
  id: string;
  competencyId: string;
  competencyName: string;
  courseId: string;
  courseTitle: string;
  progress: number;
  complete: boolean;
  /** development timeline - required by the requirement pack */
  startDate: string;
  dueDate: string;
  /** "raise Process from 2 to 3" */
  fromLevel: number;
  toLevel: number;
  /** Online Course | Coaching | On-the-job Training */
  activity: "Online Course" | "Coaching" | "On-the-job Training";
  remark?: string;
  /** learning evidence attached by the employee */
  evidence?: GoalEvidence[];
};

export type GoalEvidence = {
  id: string;
  kind: "certificate" | "link" | "note";
  label: string;
  /** certificate id, URL, or the note body */
  ref: string;
  addedAt: string;
};

export type RedeemRecord = {
  id: string;
  rewardId: string;
  rewardName: string;
  points: number;
  date: string;
  status: "Delivered" | "Preparing";
};

export type AssessmentState = {
  /** competencyId -> rating 1..4 */
  answers: Record<string, number>;
  submittedAt: string | null;
};

type EmployeeRow = Person;

export type Lang = "en" | "th";

export type AppNotification = {
  id: string;
  /** who should see it; "*" means everyone */
  audience: string;
  title: string;
  body: string;
  kind: "assessment" | "idp" | "lms" | "reward" | "system";
  channel: "In-app" | "Email" | "Both";
  createdAt: string;
  read: boolean;
  href?: string;
};

export type ActivityEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
};

export type KpiItem = {
  id: string;
  name: string;
  target: string;
  weight: number;
  score: number | null;
};

export type Weights = {
  kpi: number;
  core: number;
  functional: number;
  managerial: number;
};

export type Certificate = {
  id: string;
  personId: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  score: number;
};

export type TestResult = { pre: number | null; post: number | null };

export type DemoState = {
  role: Role | null;
  personId: string | null;
  lang: Lang;

  /** self assessment, keyed by the person doing it */
  selfAssessment: Record<string, AssessmentState>;
  /** manager review, keyed by "reviewer:target" */
  managerReview: Record<string, AssessmentState>;
  /** peer review, keyed by "reviewer:target" */
  peerReview: Record<string, AssessmentState>;

  /** KPI section of the assessment, keyed by person */
  kpi: Record<string, KpiItem[]>;
  weights: Weights;

  notifications: AppNotification[];
  activityLog: ActivityEntry[];
  certificates: Certificate[];
  /** courseId -> pre/post test scores for the logged-in demo user */
  testResults: Record<string, TestResult>;

  idp: Record<string, IdpGoal[]>;
  points: Record<string, number>;
  redeemed: RedeemRecord[];
  rewardStock: Record<string, number>;
  courseProgress: Record<string, number>; // courseId -> 0..100
  teamNotes: Record<string, string>;

  employees: EmployeeRow[];
  courses: Course[];
  rewards: Reward[];
  achievements: Achievement[];
  announcements: Announcement[];
  toast: string | null;
};

/**
 * A development plan is only credible if it targets the gaps that person
 * actually has. Seed each employee's IDP from their own manager assessment
 * against the expected level for their career role - never a shared template.
 */
function defaultIdpFor(p: Person): IdpGoal[] {
  const assessed = COMPETENCIES.filter((c) => isAssessed(p.jobRole, c.id)).map(
    (c) => {
      const score = p.managerScores[c.id] ?? 3;
      const expected = expectedFor(p.jobRole, c.id) ?? 3;
      return { competency: c, score, expected, gap: score - expected };
    },
  );

  // closing a real shortfall always comes first
  const gaps = assessed
    .filter((r) => r.gap < 0)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 4);

  // Core is the company DNA everyone is expected to keep growing, so a plan
  // always carries at least one Core goal - a stretch to the next level on the
  // weakest Core competency when there is no shortfall to close. Functional and
  // Managerial stay empty unless there is a real gap.
  const groups: Group[] = ["core"];
  for (const group of groups) {
    const inGroup = assessed.filter((r) => r.competency.group === group);
    if (!inGroup.length) continue;
    if (gaps.some((r) => r.competency.group === group)) continue;
    const weakest = [...inGroup].sort(
      (a, b) => a.score - b.score || a.gap - b.gap,
    )[0]!;
    if (weakest.score >= 4) continue;
    gaps.push({ ...weakest, expected: Math.min(4, weakest.score + 1) });
  }

  const ACTIVITIES: IdpGoal["activity"][] = [
    "Online Course",
    "Coaching",
    "On-the-job Training",
  ];

  const manager = PEOPLE.find((x) => x.id === p.reportTo);
  const assignedBy = manager ? manager.name : "HROD";
  const taken = new Set<string>();
  const day = 86_400_000;

  return gaps.map((row, i) => {
    // prefer the course written for this competency, then any unused course in
    // the same competency group, so one plan never lists the same course twice
    const exact = COURSES.find(
      (c) => c.competencyId === row.competency.id && !taken.has(c.id),
    );
    const sameGroup = COURSES.find(
      (c) =>
        !taken.has(c.id) &&
        COMPETENCIES.some(
          (x) => x.id === c.competencyId && x.group === row.competency.group,
        ),
    );
    const anyFree = COURSES.find((c) => !taken.has(c.id));
    const course = exact ?? sameGroup ?? anyFree ?? COURSES[0]!;
    taken.add(course.id);

    // deterministic spread so the timeline shows on-track, at-risk, overdue and
    // complete goals, all anchored to today rather than a fixed calendar year
    const seed = (p.employeeId.charCodeAt(p.employeeId.length - 1) + i * 7) % 5;
    const progress = [0, 15, 45, 80, 100][seed]!;
    const startedDaysAgo = 20 + i * 15;
    const lasts = 90 + (seed % 3) * 30;
    const start = new Date(Date.now() - startedDaysAgo * day);
    const due = new Date(start.getTime() + lasts * day);
    return {
      id: `g-${p.id}-${row.competency.id}`,
      competencyId: row.competency.id,
      competencyName: row.competency.name,
      courseId: course.id,
      courseTitle: course.title,
      progress,
      complete: progress >= 100,
      startDate: start.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      fromLevel: row.score,
      toLevel: row.expected,
      activity: ACTIVITIES[i % ACTIVITIES.length]!,
      remark:
        row.gap < 0
          ? `Assigned by ${assignedBy}`
          : `Stretch goal · assigned by ${assignedBy}`,
    };
  });
}

/**
 * A goal that points at a course takes its progress from the course, so
 * finishing the course in the LMS moves the development plan without anyone
 * having to write the same number twice.
 */
export function goalProgress(state: DemoState, goal: IdpGoal): number {
  const fromCourse = state.courseProgress[goal.courseId];
  return typeof fromCourse === "number" ? fromCourse : goal.progress;
}

export function goalIsComplete(state: DemoState, goal: IdpGoal): boolean {
  return goalProgress(state, goal) >= 100;
}

/** Goals across every person that are driven by this course. */
export function goalsForCourse(state: DemoState, courseId: string) {
  return Object.entries(state.idp).flatMap(([personId, goals]) =>
    goals.filter((g) => g.courseId === courseId).map((g) => ({ personId, goal: g })),
  );
}

const defaultKpi = (): KpiItem[] => [
  {
    id: "k1",
    name: "Delivery on committed sprint scope",
    target: "≥ 90% of committed points delivered",
    weight: 40,
    score: null,
  },
  {
    id: "k2",
    name: "Defect escape rate",
    target: "≤ 3 production defects per quarter",
    weight: 30,
    score: null,
  },
  {
    id: "k3",
    name: "Code review turnaround",
    target: "Median review closed within 1 working day",
    weight: 30,
    score: null,
  },
];

const seedNotifications = (): AppNotification[] => [
  {
    id: "n1",
    audience: "*",
    title: "Q1 assessment cycle is open",
    body: "Self assessment closes on 28 Feb. Complete Core and Functional first.",
    kind: "assessment",
    channel: "Both",
    createdAt: "2026-01-05T09:00:00Z",
    read: false,
    href: "/assessment",
  },
  {
    id: "n2",
    audience: "*",
    title: "Your IDP has a new goal",
    body: "Your manager added “Leadership and Team Dynamics” to your development plan.",
    kind: "idp",
    channel: "In-app",
    createdAt: "2026-02-11T03:20:00Z",
    read: false,
    href: "/idp",
  },
  {
    id: "n3",
    audience: "*",
    title: "New course available: Advanced AWS",
    body: "8 lessons, 18 hours, counts toward Software Architecture and Design.",
    kind: "lms",
    channel: "In-app",
    createdAt: "2026-02-20T06:00:00Z",
    read: true,
    href: "/lms",
  },
];

const seedActivity = (): ActivityEntry[] => [
  {
    id: "a1",
    at: "2026-04-30T08:12:00Z",
    actor: "boss",
    action: "Submitted manager review",
    target: "Kengkra Samad",
  },
  {
    id: "a2",
    at: "2026-04-29T11:40:00Z",
    actor: "neo",
    action: "Updated expected level",
    target: "Process",
    detail: "Team Lead 3 → 3",
  },
  {
    id: "a3",
    at: "2026-04-28T04:05:00Z",
    actor: "kengkra",
    action: "Completed course",
    target: "Design System",
  },
];

function initialState(): DemoState {
  const points: Record<string, number> = {};
  PEOPLE.forEach((p) => (points[p.id] = p.points));
  const idp: Record<string, IdpGoal[]> = {};
  PEOPLE.forEach((p) => (idp[p.id] = defaultIdpFor(p)));
  const rewardStock: Record<string, number> = {};
  REWARDS.forEach((r) => (rewardStock[r.id] = r.stock));
  const kpi: Record<string, KpiItem[]> = {};
  PEOPLE.forEach((p) => (kpi[p.id] = defaultKpi()));
  return {
    role: null,
    personId: null,
    lang: "en",
    selfAssessment: {},
    managerReview: {},
    peerReview: {},
    kpi,
    weights: { kpi: 40, core: 20, functional: 25, managerial: 15 },
    notifications: seedNotifications(),
    activityLog: seedActivity(),
    certificates: [
      {
        id: "cert-1",
        personId: "boss",
        courseId: "design-system",
        courseTitle: "Design System",
        issuedAt: "2026-03-18",
        score: 92,
      },
    ],
    testResults: {},
    idp,
    points,
    redeemed: [
      {
        id: "h1",
        rewardId: "starbucks",
        rewardName: "Starbucks 100 THB Gift Voucher",
        points: 500,
        date: "2026-02-14",
        status: "Delivered",
      },
      {
        id: "h2",
        rewardId: "tshirt",
        rewardName: "1 Moby T-shirt",
        points: 900,
        date: "2026-03-02",
        status: "Delivered",
      },
      {
        id: "h3",
        rewardId: "tumbler",
        rewardName: "Tumbler",
        points: 1500,
        date: "2026-04-19",
        status: "Preparing",
      },
    ],
    rewardStock,
    courseProgress: Object.fromEntries(
      Object.values(idp)
        .flat()
        .map((g) => [g.courseId, g.progress]),
    ),
    teamNotes: {},
    employees: PEOPLE.filter((p) => p.id !== "neo"),
    courses: COURSES,
    rewards: REWARDS,
    achievements: ACHIEVEMENTS,
    announcements: ANNOUNCEMENTS,
    toast: null,
  };
}

type Ctx = {
  state: DemoState;
  ready: boolean;
  person: Person | null;
  update: (fn: (s: DemoState) => DemoState) => void;
  login: (role: Role) => void;
  logout: () => void;
  notify: (msg: string) => void;
  addPoints: (personId: string, delta: number) => void;
  /** append to the audit trail */
  logActivity: (action: string, target: string, detail?: string) => void;
  /** raise an in-app notification (and pretend to send the email) */
  pushNotification: (
    n: Omit<AppNotification, "id" | "createdAt" | "read">,
  ) => void;
};

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DemoState>;
        setState((s) => ({ ...s, ...saved, toast: null }));
      }
    } catch {
      /* ignore corrupt state, fall back to defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const { toast: _toast, ...rest } = state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      /* quota or private mode - demo still works in memory */
    }
  }, [state, ready]);

  const update = useCallback((fn: (s: DemoState) => DemoState) => {
    setState((s) => fn(s));
  }, []);

  const notify = useCallback((msg: string) => {
    setState((s) => ({ ...s, toast: msg }));
    window.setTimeout(() => setState((s) => ({ ...s, toast: null })), 2600);
  }, []);

  const login = useCallback((role: Role) => {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;
    setState((s) => ({ ...s, role, personId: account.personId }));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...s, role: null, personId: null }));
  }, []);

  const addPoints = useCallback((personId: string, delta: number) => {
    setState((s) => ({
      ...s,
      points: { ...s.points, [personId]: (s.points[personId] ?? 0) + delta },
    }));
  }, []);

  const logActivity = useCallback(
    (action: string, target: string, detail?: string) => {
      setState((s) => ({
        ...s,
        activityLog: [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            actor: s.personId ?? "system",
            action,
            target,
            detail,
          },
          ...s.activityLog,
        ].slice(0, 200),
      }));
    },
    [],
  );

  const pushNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      setState((s) => ({
        ...s,
        notifications: [
          {
            ...n,
            id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
            read: false,
          },
          ...s.notifications,
        ].slice(0, 100),
      }));
    },
    [],
  );

  const person = useMemo(
    () => (state.personId ? findPerson(state.personId) : null),
    [state.personId],
  );

  const value = useMemo(
    () => ({
      state,
      ready,
      person,
      update,
      login,
      logout,
      notify,
      addPoints,
      logActivity,
      pushNotification,
    }),
    [
      state,
      ready,
      person,
      update,
      login,
      logout,
      notify,
      addPoints,
      logActivity,
      pushNotification,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}

export function resetDemo() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.href = "/login";
}
