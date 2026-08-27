# Phase 2 — real data, full requirement coverage, bilingual UI

Phase 1 built the screens from Figma. Phase 2 makes the demo behave like the real product
described in the client's requirement pack, on top of the client's own mock dataset.

Read `docs/design-brief.md` first for tokens, shared components and the Figma reference.

## What changed under you

### The data layer is now generated from the client workbook

`scripts/generate_framework.py` reads *Mock Data _1Moby (2).xlsx* and writes:

- **`src/data/framework.ts`** — `FRAMEWORK` (13 competencies with the Thai definition, the Thai
  sub-competency line, and all four levels with Thai level description + behaviour + worked
  example), `EXPECTED_BY_ROLE`, `expectedFor(role, competencyId)`, `isAssessed(role, competencyId)`.
- **`src/data/people.generated.ts`** — the 22 real employees with `selfScores` and `managerScores`.

**The expected-level matrix is real and it matters.** From the workbook's *Map Level* sheet:

| Competency | Executive | Senior | Specialist | Team Lead | Specialist Lead | Manager | Expertise | Director |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Process | – | – | 3 | 3 | 4 | 3 | 4 | 4 |
| Purpose | – | – | – | 3 | – | 3 | 4 | 4 |
| People | – | 3 | – | 4 | 3 | 4 | 4 | 4 |
| Result | – | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Core ×4 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Functional ×5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

`–` means **not assessed** — never render a rating control, a radar spoke, or a gap row for a
competency where `isAssessed(person.jobRole, id)` is false. Executives are not assessed on any
Managerial competency at all.

### Gap analysis is defined by the client

`gap = manager score − expected level`, and the verdict wording comes from their sheet:

| Gap | Verdict | English | Thai |
| --- | --- | --- | --- |
| `> 0` | `strength` | Strength | จุดแข็ง |
| `= 0` | `standard` | Competency Fit | ตรงตามมาตรฐาน |
| `-1 < gap < 0` | `development` | Development | ควรพัฒนา |
| `<= -1` | `critical` | Critical | ต้องพัฒนาเร่งด่วน |

Use `verdictFor(gap)` and `GAP_VERDICT_LABEL` from `src/data/competencies.ts`.

### People

`src/data/people.ts` exports `PEOPLE` (22 staff + the `neo` admin account), `STAFF`,
`findPerson`, `directReportsOf(managerId)`, `TEAM_MEMBER_IDS` (Boss Kitty's six direct reports),
`groupsForRole`, `DEPARTMENTS` / `DIVISIONS` / `POSITIONS` / `JOB_ROLES` (all derived from the 22),
and `CAREER_LADDER` (the 1Moby Careers grade chart).

`Person` now carries `employeeId`, `nickname`, `grade`, `businessUnit`, `remark`,
`selfScores`, `managerScores` alongside the previous fields. `scores` is the manager
assessment — the official result.

Boss Kitty is now a **Team Lead (Level 3: Supervise)** with six direct reports, which is what
makes the manager screens coherent — a Senior is not assessed on Process/Purpose at all.
Kengkra is an **Executive (Level 1: Operation)**: Core + Functional only.

### New store fields (all already wired, just use them)

```ts
lang: "en" | "th"
peerReview:   Record<"reviewerId:targetId", AssessmentState>
managerReview:Record<"reviewerId:targetId", AssessmentState>
kpi:          Record<personId, KpiItem[]>        // name, target, weight, score
weights:      { kpi, core, functional, managerial }
notifications: AppNotification[]                  // audience "*" or a personId
activityLog:  ActivityEntry[]                     // audit trail
certificates: Certificate[]
testResults:  Record<courseId, { pre, post }>
```

`useDemo()` additionally returns `logActivity(action, target, detail?)` and
`pushNotification({ audience, title, body, kind, channel, href? })`. **Call `logActivity` on every
state-changing action you add** — the audit trail page reads it.

`IdpGoal` now has `startDate`, `dueDate`, `fromLevel`, `toLevel`, `activity`
(`"Online Course" | "Coaching" | "On-the-job Training"`) and optional `remark`.

## Bilingual — required on every screen you touch

```tsx
import { useT } from "@/lib/i18n";
const { t, tt, lang } = useT();

t("nav.dashboard")                       // shared vocabulary, see src/lib/i18n.tsx DICT
tt("Team Profile", "โปรไฟล์ทีม")          // page-specific copy, inline pair
```

The language switch lives in the top bar and is already wired. Rules:

- **Every user-visible string** on a page you touch must go through `t()` or `tt()`.
  That includes headings, table headers, button labels, empty states, toasts and modal copy.
- Add a key to `DICT` only when the string appears on more than one screen — otherwise `tt()`.
  You may append to `DICT`; do not reorder or remove existing keys.
- Competency definitions have real Thai in `FRAMEWORK` (`definitionTh`, `levels[].descTh`,
  `levels[].behaviorTh`). Use those when `lang === "th"` rather than translating yourself.
- Thai text is taller than Latin — do not pin heights on anything containing copy.

## Ground rules

1. Only touch the paths listed in your task. Other agents are working in parallel.
2. Do **not** edit `src/lib/store.tsx`, `src/lib/i18n.tsx` (except appending to `DICT`),
   `src/data/framework.ts`, `src/data/people*.ts`, `src/data/competencies.ts`,
   `src/components/ui/index.tsx`, `src/components/charts/index.tsx`,
   `src/components/layout/*`. If you need something there, work around it and say so in your report.
3. Do **not** run `next build` or `next dev` — parallel agents collide on `.next/`.
   Verify with `npx tsc --noEmit` from the project root.
4. Every control must do something real. No dead handlers, no `href="#"`.
5. Keep to the design tokens. Tables scroll horizontally inside their card below `lg`.
