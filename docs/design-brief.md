# 1Moby Demo — build brief

Demo of the **Comprehensive Assessment System** (competency assessment → IDP → LMS →
gamification). Next.js 15 App Router + TypeScript + Tailwind v4. No backend, no database:
everything lives in a client-side store persisted to `localStorage`. Target host: Vercel.

Source of truth for layout and copy is the Figma file `1Moby - Demo (Copy)`
(file key kept out of this repo).

## Extracted Figma reference

Text dumps of every frame (positions, font size/weight, exact copy) live in:

```
<scratchpad>/screens/   (local working copy, not committed)
```

Each file is named `<nodeid>__<FrameName>.txt`, lines formatted `[y,x] fontSize/weight  text`.
Rendered PNGs of the main screens are in the sibling `png/` folder (`<nodeid>.png`).
`index.json` in the scratchpad root lists every frame.

To render more frames as PNG (token has read access to the file):

```bash
cd <scratchpad> && TOK=$(cat figtok.txt) && curl -s -H "X-Figma-Token: $TOK" \
  "https://api.figma.com/v1/images/<FIGMA_FILE_KEY>?ids=294:17801&format=png&scale=0.5"
```

## Design tokens (Tailwind v4, defined in `src/app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `brand` | `#006BFF` | sidebar, primary buttons, links |
| `brand-dark` | `#0061C8` | active nav item, button hover |
| `brand-tint` | `#EAF3FF` | soft info panels, icon chips |
| `ink` | `#1C1E29` | headings, dark panels |
| `muted` | `#697077` | secondary text |
| `line` / `line-2` | `#DDE1E6` / `#C1C7CD` | borders, dividers |
| `surface` | `#F2F0F2` | page tints, track backgrounds |
| `accent` | `#F05123` | user chip, play button, "Managerial" pill |
| `amber` | `#FAA21B` | skill-point bars, radar fill, rank 1 |
| `success` | `#00B916` | positive stats |
| heat map | `heat-good/mid/low/bad` | competency heat map cells |

Font is **Geologica** (loaded in `src/app/layout.tsx`). Headings use weight 500,
nav and card titles 700, body 300/400.

Visual language: white cards, `rounded-xl`, hairline `border-line/70`, very soft shadow.
Sidebar is a solid `brand` column 250px wide with an `accent` user chip under the logo.

## Shared code — read, do not modify

| File | What it gives you |
| --- | --- |
| `src/components/ui/index.tsx` | `Button` `Card` `CardHeader` `Stat` `Tabs` `Pill` `Progress` `Avatar` `Modal` `Field` `Input` `Textarea` `Select` `EmptyState` `PageHeading` |
| `src/components/charts/index.tsx` | `CompetencyRadar` `Donut` `DonutLegend` `heatColor` |
| `src/components/layout/*` | `Sidebar`, `Logo`, `Toast`, `nav.ts` (per-role menus) |
| `src/lib/store.tsx` | `DemoProvider`, `useDemo()`, `resetDemo()` |
| `src/lib/selectors.ts` | `scoreFor` `radarData` `gapList` `overallScore` `teamMembers` `idpProgress` `assessmentDone` |
| `src/lib/utils.ts` | `cn`, `initials`, `formatNumber` |
| `src/data/competencies.ts` | 13 competencies (4 core, 5 functional, 4 managerial) with real definitions + behavioural indicators, `RATING_LABELS` 1–4 |
| `src/data/people.ts` | 15 people, org lists (`DEPARTMENTS` `DIVISIONS` `POSITIONS` `JOB_ROLES`), `DEMO_ACCOUNTS`, `TEAM_MEMBER_IDS` |
| `src/data/learning.ts` | `COURSES` (with chapters), `BADGES`, `REWARDS`, `POINT_RULES`, `ANNOUNCEMENTS`, `ACHIEVEMENTS` |

`useDemo()` returns `{ state, ready, person, update, login, logout, notify, addPoints }`.
`update(fn)` takes an immutable updater. `notify("...")` shows a toast.

## Roles

| Role | Person | Menu |
| --- | --- | --- |
| `l1` | Kengkra Samad — Level 1: Operation | Dashboard, IDP, LMS, Achievements, Assessment, Reward |
| `l2` | Boss Kitty — Level 2: Senior Operation | + Team Profile |
| `admin` | Neo | Dashboard, LMS, Employee, Assessment, Achievements, Reward, Announcement |

`l1` is assessed on Core + Functional. `l2` adds Managerial (see `GROUPS_FOR_LEVEL`).

## Rules for every page

1. `"use client"` at the top of interactive pages; read data through `useDemo()`.
2. Wrap page content in `<div className="p-6 lg:p-10 max-w-[1200px]">` and lead with
   `<PageHeading title="..." />` — matches the Figma left margin and 48px title.
3. **Buttons must work.** No `href="#"`, no dead handlers. Every button either navigates,
   mutates the store, opens a modal, or toggles local state. Where a real system would call
   an API, mutate the store and call `notify(...)`.
4. Keep it responsive — the mocks are 1457px wide desktop; below `lg` collapse to one column.
5. Type-check with `npx tsc --noEmit` (do **not** run `next build`; other agents build in
   parallel and would collide on `.next/`).
6. Never invent a new colour — use the tokens above.
