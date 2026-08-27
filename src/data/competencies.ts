import {
  FRAMEWORK,
  LEVEL_LABEL_EN,
  LEVEL_LABEL_TH,
  expectedFor,
  isAssessed,
  type Group,
  type LevelDetail,
} from "./framework";

export type { Group, LevelDetail };

export type Competency = {
  id: string;
  group: Group;
  name: string;
  /** English definition */
  definition: string;
  /** Thai definition, straight from the client competency framework */
  definitionTh: string;
  /** English behavioural indicators */
  indicators: string[];
  /** Thai level-by-level descriptions and behaviours (score 4 first) */
  levels: LevelDetail[];
  /** default expected level; use expectedFor(role, id) for the real value */
  expected: number;
};

export const RATING_LABELS: Record<number, string> = LEVEL_LABEL_EN;
export const RATING_LABELS_TH: Record<number, string> = LEVEL_LABEL_TH;

export const GROUP_LABEL: Record<Group, string> = {
  core: "Core",
  functional: "Functional",
  managerial: "Managerial",
};

export const GROUP_LABEL_TH: Record<Group, string> = {
  core: "สมรรถนะหลัก",
  functional: "สมรรถนะตามสายงาน",
  managerial: "สมรรถนะการบริหาร",
};

/** English definitions and indicators, matched to the framework by id. */
const EN: Record<string, { definition: string; indicators: string[] }> = {
  "create-impact": {
    definition:
      "Focuses on delivering high-value results that align with business goals and drive project success",
    indicators: [
      "Identifies and prioritizes tasks that deliver the most significant value to the product or user",
      "Proactively proposes solutions that improve system efficiency, reduce costs, or enhance user experience",
      "Measures and evaluates the outcomes of their work to ensure a positive business impact",
    ],
  },
  "take-ownership": {
    definition:
      "Assumes full responsibility for tasks, projects, and outcomes from inception to completion",
    indicators: [
      "Takes accountability for both successes and failures without making excuses or blaming others",
      "Follows through on commitments and ensures tasks are completed to a high standard",
      "Proactively identifies potential blockers and takes action to resolve them independently",
    ],
  },
  adaptive: {
    definition:
      "Embraces change, learns quickly, and adjusts strategies effectively in a dynamic work environment",
    indicators: [
      "Quickly learns and applies new technologies, tools, or processes when required by the project",
      "Remains flexible, resilient, and positive when faced with shifting priorities or sudden changes",
      "Successfully navigates ambiguity and makes sound decisions even with incomplete information",
    ],
  },
  collaboration: {
    definition:
      "Works effectively and inclusively with team members and cross-functional partners to achieve shared goals",
    indicators: [
      "Communicates clearly, listens actively to others, and provides/receives constructive feedback",
      "Fosters a positive team culture by respecting diverse perspectives and supporting colleagues",
      "Resolves disagreements and conflicts constructively to maintain team harmony and progress",
    ],
  },
  process: {
    definition:
      "Focuses on establishing, adhering to, and continuously improving workflows to ensure efficiency and quality",
    indicators: [
      "Follows established standard operating procedures and best practices consistently",
      "Actively identifies bottlenecks or inefficiencies in current workflows and proposes solutions",
      "Maintains clear, accurate, and up-to-date documentation for processes and systems",
    ],
  },
  purpose: {
    definition:
      'Understands the "why" behind the work and aligns daily tasks with the broader organizational vision and goals',
    indicators: [
      "Clearly connects personal and team objectives to the company's long-term mission",
      "Demonstrates passion and commitment, acting with clear intention in everyday tasks",
      "Helps others understand the value and impact of their contributions to the big picture",
    ],
  },
  people: {
    definition:
      "Prioritizes building strong relationships, fostering an inclusive environment, and supporting the growth of others",
    indicators: [
      "Actively mentors, coaches, and shares knowledge to help colleagues develop their skills",
      "Demonstrates empathy, active listening, and respect for diverse backgrounds and opinions",
      "Contributes to a psychologically safe team culture where everyone feels valued and heard",
    ],
  },
  result: {
    definition:
      "Driven by outcomes, consistently delivering high-quality work that meets or exceeds established goals",
    indicators: [
      "Sets ambitious but achievable targets and consistently meets deadlines",
      "Maintains a strong focus on delivering measurable outcomes rather than just completing tasks",
      "Takes proactive steps to overcome obstacles that threaten project delivery or quality",
    ],
  },
  programming: {
    definition:
      "Demonstrates the ability to write high-quality, efficient, and maintainable source code",
    indicators: [
      "Writes clean, readable code following industry best practices",
      "Implements comprehensive unit tests to ensure code reliability",
      "Optimizes code performance and minimizes technical debt",
    ],
  },
  architecture: {
    definition:
      "Understands and applies architectural patterns and design principles to build scalable systems",
    indicators: [
      "Selects appropriate design patterns (e.g., SOLID, MVC) for the problem",
      "Designs modular and decoupled systems that are easy to extend",
      "Considers scalability, security, and system constraints during design",
    ],
  },
  databases: {
    definition:
      "Proficient in designing schemas, managing data, and optimizing database performance",
    indicators: [
      "Designs efficient database schemas and maintains data integrity",
      "Writes and optimizes complex SQL/NoSQL queries for performance",
      "Understands data caching strategies and migration processes",
    ],
  },
  "version-control": {
    definition:
      "Effectively manages code changes and collaborates using version control systems",
    indicators: [
      "Follows standardized branching and merging strategies (e.g., GitFlow)",
      "Writes clear, descriptive commit messages for better traceability",
      "Resolves merge conflicts efficiently and performs thorough code reviews",
    ],
  },
  analytical: {
    definition:
      "Breaks down complex problems and organises effort so that work lands on time and at quality",
    indicators: [
      "Performs root cause analysis to solve deep-seated technical issues",
      "Prioritizes tasks effectively based on impact and urgency",
      "Delivers high-quality work consistently within agreed timelines",
    ],
  },
};

export const COMPETENCIES: Competency[] = FRAMEWORK.map((f) => ({
  id: f.id,
  group: f.group,
  name: f.name,
  definition: EN[f.id]?.definition ?? f.definitionTh,
  definitionTh: f.definitionTh,
  indicators: EN[f.id]?.indicators ?? [],
  levels: f.levels,
  expected: 3,
}));

export const findCompetency = (id: string) =>
  COMPETENCIES.find((c) => c.id === id);

export const byGroup = (g: Group) => COMPETENCIES.filter((c) => c.group === g);

/** Competencies a specific career role is actually assessed on. */
export const assessedFor = (jobRole: string, g?: Group) =>
  COMPETENCIES.filter(
    (c) => (!g || c.group === g) && isAssessed(jobRole, c.id),
  );

export const GROUPS: Group[] = ["core", "functional", "managerial"];

/**
 * Gap = manager score - expected level. The wording comes from the client's
 * "ความหมายและคำนิยาม" sheet.
 */
export type GapVerdict = "strength" | "standard" | "development" | "critical";

export const GAP_VERDICT_LABEL: Record<GapVerdict, { en: string; th: string }> = {
  strength: { en: "Strength", th: "จุดแข็ง" },
  standard: { en: "Competency Fit", th: "ตรงตามมาตรฐาน" },
  development: { en: "Development", th: "ควรพัฒนา" },
  critical: { en: "Critical", th: "ต้องพัฒนาเร่งด่วน" },
};

export function verdictFor(gap: number): GapVerdict {
  if (gap > 0) return "strength";
  if (gap === 0) return "standard";
  if (gap > -1) return "development";
  return "critical";
}

export { expectedFor, isAssessed };

/**
 * Kept for the screens that key off the level string. Derived from the
 * client's Map Level sheet rather than hand-maintained.
 */
export const GROUPS_FOR_LEVEL: Record<string, Group[]> = {
  "Level 1: Operation": ["core", "functional"],
  "Level 2: Senior Operation": ["core", "functional", "managerial"],
  "Level 3: Supervise": ["core", "functional", "managerial"],
  "Level 4: Management": ["core", "functional", "managerial"],
  "Level 5: Strategy": ["core", "functional", "managerial"],
  Admin: ["core", "functional", "managerial"],
};
