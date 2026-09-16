# Phase 3 — from localStorage demo to a real system

The product is the same; the plumbing underneath it changed completely.

## What exists now

**PostgreSQL through Prisma 7.** `prisma/schema.prisma` models the whole domain.
Locally the database is PGlite (real Postgres compiled to WASM) so everything runs before
Supabase credentials exist:

```bash
npm run db:dev      # start the local database on 127.0.0.1:5433 — leave this running
npm run db:push     # apply the schema
npm run db:seed     # load the client workbook data
npx tsx scripts/check-db.ts   # health check
```

Seeded and verified: 22 employees, 13 competencies, 104 expected-level cells (9 deliberately
*not assessed*), 486 assessment scores across self and supervisor, 39 courses, 94 chapters,
2 learning paths, 3 roles, 18 permissions, 4 rewards, 11 badges, 3 announcements.

**Auth.js v5 with Google**, plus a demo credentials provider behind
`NEXT_PUBLIC_ENABLE_DEMO_LOGIN`. Sessions are JWT; role and permissions ride in the token and
refresh every five minutes, so an admin changing a role takes effect without a re-login.

**Authorisation lives on the server** in `src/server/session.ts`:

| helper | use |
| --- | --- |
| `getViewer()` | request-cached, returns `Viewer \| null` |
| `requireViewer()` / `requireEmployee()` / `requirePermission(key)` | **pages** — redirect |
| `assertViewer()` / `assertEmployee()` / `assertPermission(key)` | **server actions** — throw `NotAuthorised` |
| `assertCanSeeEmployee(id)` / `assertManagerOf(id)` | row-level checks |
| `recordActivity({ viewer, action, ... })` | the audit trail |

Middleware only answers "is anyone signed in". **Never rely on it for permissions** — every
server action must call an assert of its own.

**The gap engine** is `src/server/competency.ts`: `getGapRows(employeeId)`, `getPersonSummary`,
`getTeamSummaries`, `getPointsBalance`, `getPointsLeaderboard`, `verdictFor`, `VERDICT_LABEL`.
Two client rules are enforced there so no screen can get them wrong:

1. a competency with **no expected level** for that career role is **not assessed** and is absent
   from the rows entirely — never rendered as a zero;
2. `gap = supervisor score − expected level`, verdicts Strength / Competency Fit / Development /
   Critical.

**The client knows who it is** through `useViewer()` (`src/lib/viewer.tsx`):
`{ userId, email, name, status, roleKey, roleName, permissions, employeeId, employeeName,
jobRoleName, level, reportCount }`, plus `usePermission().can(key)`.
Navigation is derived from permissions in `src/components/layout/nav.ts` (`navFor`, `homeFor`,
`canAccess`) — do not reintroduce a per-role menu table.

**Permission keys** are in `src/lib/permissions.ts` (`PERMISSIONS`). They are a closed set; each
entry in `PERMISSION_CATALOGUE` cites the clause of the client requirement pack it comes from.

## What has not moved yet

`src/lib/store.tsx` (`useDemo()`) still holds assessment answers, IDP, LMS progress, rewards,
notifications and the activity log in `localStorage`. Pages that have not been converted still
read it, and because nothing calls `login()` any more their state is empty — that is the
migration gap, not a bug to work around.

**When you convert a screen, delete its use of `useDemo()` rather than feeding the store from the
server.** Read through server components and mutate through server actions.

## House rules

1. **Server actions**: `"use server"`, validate input with `zod`, call an `assert*` guard first,
   write through `db`, call `recordActivity`, then `revalidatePath`. Return a typed result rather
   than throwing for expected validation failures.
2. **Never trust a client-supplied employee id.** Resolve the viewer's own id from the session;
   for anyone else's, call `assertCanSeeEmployee` or `assertManagerOf`.
3. **Bilingual**: every user-visible string goes through `t()` / `tt()` from `useT()`. Database
   text carries `...En` / `...Th` columns — pick by `lang`, and fall back to English.
4. **Queries**: no N+1 in a loop where a single `findMany` with `in` would do. Everything the
   dashboard needs should be a handful of queries, not one per row.
5. Keep the existing design tokens and the mobile work: `Modal` is a bottom sheet below `lg`,
   tables go through `ResponsiveTable`, buttons are 44px on phones, motion honours
   `prefers-reduced-motion`.
6. Verify with `npx tsc --noEmit`. Do **not** run `next build` or `next dev` — a dev server and
   the local database are already running and other agents share them.
