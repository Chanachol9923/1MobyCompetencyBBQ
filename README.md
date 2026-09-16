# 1Moby — Comprehensive Assessment System

Competency assessment → individual development plan → learning, for 1Moby. Next.js 15 on
PostgreSQL, with Google sign-in and role-based access control an administrator can change without
a deploy.

The screens follow the Figma design (`1Moby - Demo`); the data model and the rules come from the
client's own competency framework workbook.

## Getting it running

### 1. A database

**Supabase** in any real environment. Copy `.env.example` to `.env` and fill in both connection
strings — the pooled one for the app, the direct one for migrations. `.env.example` explains which
is which and why.

For local work without Supabase there is a throwaway Postgres built in: PGlite, real Postgres
compiled to WebAssembly, behind a normal TCP port.

```bash
npm run db:dev
```

Leave that running, then in another terminal:

```bash
npm run db:push
```

```bash
npm run db:seed
```

```bash
npm run dev
```

`npx tsx scripts/check-db.ts` prints a health check of what landed.

> On Windows PowerShell, `npm` may be blocked by the execution policy. Use `npm.cmd run dev`, or
> allow scripts once with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### 2. Google sign-in

Google Cloud Console → **APIs & Services → Credentials → OAuth client ID**, type *Web application*,
with redirect URIs:

```
http://localhost:3000/api/auth/callback/google
https://<your-domain>/api/auth/callback/google
```

Put the id and secret in `.env`, and generate `AUTH_SECRET` with `npx auth secret`.

Signing in with Google does **not** make someone staff. A new account lands in `PENDING` and sees
a "waiting for approval" screen until an administrator links it to an employee record and gives it
a role. Emails listed in `BOOTSTRAP_ADMIN_EMAILS` are made administrators on first sign-in, which
is how you get the first one.

### 3. Demo accounts

`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` adds one-click sign-in for seeded personas — an individual
contributor, a manager with reports, and the HROD administrator — so the system can be walked
through in a meeting without anyone owning a Google account. The accounts are read from the
database, not hard-coded. Set the flag to `false` for a real deployment and the door is gone.

## The rules the product is built on

Both come from the client's workbook and are enforced in `src/server/competency.ts` so no screen
can get them wrong.

**Who is assessed on what.** A competency with no expected level for a career role is *not
assessed* — no rating control, no radar spoke, no gap row, no heat-map colour. Executives are not
assessed on any Managerial competency at all.

| Competency | Executive | Senior | Specialist | Team Lead | Specialist Lead | Manager | Expertise | Director |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Process | – | – | 3 | 3 | 4 | 3 | 4 | 4 |
| Purpose | – | – | – | 3 | – | 3 | 4 | 4 |
| People | – | 3 | – | 4 | 3 | 4 | 4 | 4 |
| Result | – | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Core ×4, Functional ×5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

**What a gap means.** `gap = supervisor score − expected level`, with the client's wording:
Strength (`> 0`) · Competency Fit (`= 0`) · Development (`−1 < gap < 0`) · Critical (`≤ −1`).

## Architecture

```
Browser ─ server components ─┐
                             ├─ src/server/*  guards, queries, server actions
Browser ─ server actions ────┘        │
                                      └─ Prisma ─ pgBouncer ─ PostgreSQL (Supabase)
```

- **Authorisation is server-side**, in `src/server/session.ts`, next to the data it protects.
  Middleware only answers "is anyone signed in"; it cannot reach the database and is never trusted
  for permissions.
- **Roles and permissions are rows**, not code. An administrator edits them in `/admin/roles` and
  the change reaches signed-in users within five minutes, or immediately on their next sign-in.
- **Navigation is derived from permissions**, so the menu cannot drift from what someone may
  actually do.
- **Points are an append-only ledger** rather than a running total, so a balance is always
  explainable and two concurrent awards cannot clobber each other.
- **The audit trail is append-only** and written by every server action.

## What the system does

**Assessment** — 180°: self and supervisor. The steps are derived from the target's career role,
so an Executive never sees a Managerial step. Each 1–4 option shows that level's own description
and a worked example from the framework, with the expected level marked on the scale. A KPI step
carries its own weights. The result page shows the weighted total as a readable formula, the full
gap table, and a side-by-side of self against supervisor.

**IDP** — a plan seeded from that person's own worst gaps. Goals read "raise Take Ownership from
level 2 to 3", carry dates and a development activity, derive their status from the dates and
progress, and take their progress from the linked course, so finishing it in the LMS closes the
goal. Evidence can be attached: a certificate earned in the system, a link, or a note. Managers
author goals in Team Profile; employees work them.

**Team Profile** — heat map over direct reports with N/A where a competency does not apply,
per-member radar, coaching notes, goal authoring and the review action.

**Reports** — gap analysis scoped by permission: a manager sees their team, an administrator sees
the company with department and division filters. Bar chart against expected level, sortable gap
table, generated strengths and shortfalls, CSV export.

**LMS** — 39 courses across Video / PDF / Article chapters, learning paths of five courses plus a
project, pre- and post-tests that issue a certificate automatically at 70%, and a scripted local
study assistant (clearly labelled — no model calls).

**Announcements** — a feed everyone can read, addressed to everyone or narrowed to a department,
division, career role or one person, with read receipts. Publishing fans out notifications.

**Administration** — accounts and approval, roles and permissions, the competency framework and
expected-level matrix, assessment cycles and weighting, the course library, rewards and
achievements, announcements, and the activity log.

**Bilingual** Thai/English throughout, switchable before and after sign-in. Responsive to phones,
with a bottom tab bar, card lists instead of wide tables, and motion that honours
`prefers-reduced-motion`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL · Prisma 7 · Auth.js v5 ·
Tailwind CSS v4 · Recharts · lucide-react · Geologica.

The requirement document names shadcn/ui and antd. This build uses hand-written primitives in
`src/components/ui` that follow the shadcn composition style, so they can be swapped
component-for-component without redoing the layouts.

## Deploying

1. Push to a Git repository and import it in Vercel, framework preset **Next.js**.
2. Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and
   `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`.
3. Add your production callback URL to the Google OAuth client.
4. `npx prisma db push` (or `migrate deploy`) against the production database, then `db seed` once.

`postinstall` runs `prisma generate`, so the client is built during deployment.

## Project layout

```
prisma/schema.prisma     the domain model
prisma/seed.ts           workbook data → database, idempotent
prisma.config.ts         Prisma 7 connection config
scripts/
  generate_framework.py  workbook → TypeScript source data
  dev-db.mjs             local PGlite database
  check-db.ts            health check
src/
  app/                   login, pending, forbidden, and the signed-in app
  server/                guards, queries and server actions
  components/            ui · charts · layout · profile · learning · assessment · admin
  data/                  framework and content, the seed's source
  lib/                   db, auth, permissions, viewer, i18n
docs/                    design brief and the phase briefs
```

## Known limits

- Scheduled announcements do not publish themselves; someone presses **Publish now**.
- `channel` records that something should also be emailed, but no mailer is wired.
- Exports are CSV rather than `.xlsx`; certificates render in the browser, not as PDFs.
- Parts of the learner experience — assessment answers in progress, LMS chapter progress and
  reward redemption — still keep state in the browser and are being moved onto the database.
