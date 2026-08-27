# 1Moby — Comprehensive Assessment System (Demo)

Clickable demo of the competency assessment / IDP / LMS platform: the Figma design
(`1Moby - Demo`) built as a working Next.js app on top of the client's own mock dataset.

**There is no backend and no database.** All state lives in the browser (`localStorage`), so
every flow can be exercised end to end — submit an assessment, watch the gap analysis and the
leaderboard move — without a server. Built to be deployed on Vercel.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000 — it redirects to `/login`.

> On Windows PowerShell, `npm` may be blocked by the execution policy. Use `npm.cmd run dev`,
> or allow scripts once with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Demo accounts

Three one-click buttons on the login screen — no password is checked.

| Button | Who | Role in the data |
| --- | --- | --- |
| Login as Kengkra (Role L1) | Kengkra Samad | **Executive** · Level 1: Operation — assessed on Core + Functional only |
| Login as Boss (Role L2) | Boss Kitty | **Team Lead** · Level 3: Supervise — 6 direct reports, adds Managerial |
| Login as Neo (Role Admin) | Neo | **HROD** system account — never assessed, runs the framework |

## The data is real

`scripts/generate_framework.py` reads the client's *Mock Data _1Moby* workbook and generates
`src/data/framework.ts` and `src/data/people.generated.ts`. Regenerate with:

```bash
python scripts/generate_framework.py "path/to/Mock Data _1Moby (2).xlsx"
```

From that workbook the demo takes:

- **22 employees** with their real position, role, department and division
- **Self assessment and manager assessment** scores for all 13 competencies
- **Thai competency definitions** and the level-by-level (1–4) descriptions, behaviours and
  worked examples — these drive the rating options in the wizard
- **The expected-level matrix per career role**, which decides who is assessed on what:

| Competency | Executive | Senior | Specialist | Team Lead | Specialist Lead | Manager | Expertise | Director |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Process | – | – | 3 | 3 | 4 | 3 | 4 | 4 |
| Purpose | – | – | – | 3 | – | 3 | 4 | 4 |
| People | – | 3 | – | 4 | 3 | 4 | 4 | 4 |
| Result | – | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Core ×4, Functional ×5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

`–` means the competency is not assessed for that role, and the app honours it everywhere —
no rating control, no radar spoke, no gap row, no heat-map colour.

**Gap = manager score − expected level**, with the client's own verdict wording:
Strength (`> 0`) · Competency Fit (`= 0`) · Development (`−1 < gap < 0`) · Critical (`≤ −1`).

## What works

**Assessment** — 180° (self + supervisor; peer was dropped by HR). Steps are derived from the
target's role, so an Executive never sees a Managerial step. Each 1–4 option shows that level's
own description and a worked example from the framework, with the expected level marked on the
scale. A KPI step with weights that must total 100%. The result page shows the weighted total as
a readable formula, the full gap table, and — in self mode — a side-by-side comparison against
the supervisor's scores.

**IDP** — each person's plan is seeded from their *own* worst gaps, never a shared template.
Goals read "raise Take Ownership from level 2 to 3", carry start/due dates, a development
activity (Online Course / Coaching / On-the-job Training) and a derived status
(On track / At risk / Overdue / Complete) on a timeline. Goals are authored by the manager in
Team Profile — employees work the plan, they do not write it.

**Team Profile** (manager) — team competency heat map with N/A for unassessed cells, per-member
radar and notes, goal assignment, and the evaluation action.

**Reports** — gap analysis scoped by role: manager sees their team, admin sees the company with
department and division filters. Bar chart of score vs expected, sortable gap table, a generated
read of team strengths and shortfalls, CSV export.

**LMS** — course catalogue with content types (Video / PDF / Article), a player with chapter
switching and simulated playback, pre-test and post-test that automatically issue a certificate
at ≥70%, two Learning Paths (5 courses + 1 project) that unlock step by step, and a scripted
local study assistant (clearly labelled — no model calls).

**Achievements / Reward** — podium and leaderboard over the 22 real employees, certificates from
the store, live badge progress, points balance, redeem with stock and history.

**Admin** — cycle monitoring, org donut, employee CRUD with the requirement's full data set
(Employee_ID, Level, Role, Business Unit, Department, Division, Report to, Remark), course
authoring, the expected-level matrix, weighting, achievements, rewards, announcements that fire
real notifications, notification rules, RBAC matrix, and an activity log / audit trail.

**Bilingual** — a Thai/English switch in the top bar, wired through every screen. Competency
definitions and level descriptions use the client's own Thai text. People's names and job titles
stay as they are in the source data.

**Access control** — enforced at the route level in `src/app/(app)/layout.tsx` via
`canAccess()` in `src/components/layout/nav.ts`, not just by hiding menu items. An employee who
types `/team-profile` lands back on their dashboard.

Reset everything from the browser console:

```bash
localStorage.removeItem("1moby-demo-state-v3")
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Recharts · lucide-react ·
Geologica (the Figma typeface). Design tokens taken straight from the Figma file live in
`src/app/globals.css`.

The requirement document specifies shadcn/ui + antd for production. This demo uses hand-built
primitives in `src/components/ui` that follow the shadcn composition style, so they can be
swapped component-for-component later without redoing the layouts.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. In Vercel, **Add New → Project**, import the repo, framework preset **Next.js**.
3. No environment variables are required.

```bash
npx vercel
```

## Project structure

```
src/
  app/
    login/                     role picker
    (app)/                     authenticated shell — sidebar, top bar, RBAC guard
      dashboard/               self vs manager, radar, heat map
      team-profile/            manager view, goal authoring
      idp/                     development plan + timeline
      assessment/[mode]/[target]/  the 180° wizard
      lms/                     catalogue, [courseId] player, path/[pathId]
      achievements/  reward/   gamification
      reports/                 gap analysis
      admin/                   console + audit
  components/  ui · charts · layout · profile · learning · assessment · admin
  data/        framework (generated) · people · learning · cycle · competencies
  lib/         store · i18n · selectors · utils
scripts/generate_framework.py  workbook → data layer
docs/                          design brief and phase-2 brief
```

## Not in this demo

- Real authentication / SSO, database and API layer
- `.xlsx` export (a real CSV is produced instead) and PDF certificates
- Persisted framework edits — expected-level and RBAC changes stay in the browser session
