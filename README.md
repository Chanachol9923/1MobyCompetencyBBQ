# 1Moby — Comprehensive Assessment System

Competency assessment → individual development plan → learning, for 1Moby. Next.js 15 on
PostgreSQL (Supabase), with single sign-on through company accounts that an administrator
provisions, and role-based access control that can be changed without a deploy.

The screens follow the Figma design (`1Moby - Demo`); the data model and the rules come from the
client's own competency framework workbook.

## Getting it running

### 1. A database

**Supabase** in any real environment. Copy `.env.example` to `.env` and fill in both connection
strings from Supabase → **Connect**. Use the **pooler** host (`aws-0-<region>.pooler.supabase.com`,
user `postgres.<project-ref>`): port `6543` for `DATABASE_URL`, port `5432` for `DIRECT_URL`. The
direct host `db.<project-ref>.supabase.co` is IPv6-only and Vercel cannot reach it.

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

`npm run db:check` prints a health check of what landed. The Supabase CLI is not needed — the
schema ships as Prisma migrations in `prisma/migrations`.

For local work without Supabase there is a throwaway Postgres built in: PGlite, real Postgres
compiled to WebAssembly, behind a normal TCP port. Run `npm run db:dev`, leave it running, point
both URLs at `postgresql://postgres:postgres@127.0.0.1:5433/postgres`, then migrate and seed as
above.

> On Windows PowerShell, `npm` may be blocked by the execution policy. Use `npm.cmd run dev`, or
> allow scripts once with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### 2. The database is closed to the public API

Supabase publishes every table in `public` through its REST API, reachable with the project's
publishable key — which is public by design. The first migration enables row-level security on
every table and revokes all privileges from `anon` and `authenticated`, so that API returns
`permission denied` for everything. The app connects as the table owner and is unaffected.

The migration also carries what Prisma's schema language cannot express: `CHECK` constraints
(scores 1–4, weights summing to 100, a supervisor review never written by its subject, a goal that
actually raises a level, Employee_ID of 3–4 characters, lower-case login ids…) and partial unique
indexes that make a certificate or a one-off points award impossible to issue twice.

### 3. Sign-in: company accounts, single sign-on

One account per person, **`name.sur@1moby.com`** — first name, a dot, the first three letters of the
surname — opens every module. Nobody can sign themselves up:

1. HROD creates the account in **Administration → Accounts**, for one person or for every staff
   member without one. The login id is proposed from the name and can be edited; the role
   (Employee / Manager / Administrator, or any custom role) is chosen there too.
2. The screen hands back a **one-time activation link** (72 hours) to send to the person, as a
   ready-to-paste message or a CSV for a batch.
3. The person opens it and sets their own password. No administrator ever sees a password; only a
   scrypt hash and a SHA-256 of each link are stored.

After that: five wrong passwords lock the account for 15 minutes (HROD can unlock it). **Reset
password** goes to the person's notifications and a banner by default; it waits there until they
press Start, which only then makes their one-time link. Someone who cannot sign in anywhere gets a
link HROD sends them instead; suspending an account or deactivating the staff
record signs the person out everywhere; changing a password retires every other session.

`AUTH_SSO_ISSUER`, `AUTH_SSO_CLIENT_ID` and `AUTH_SSO_CLIENT_SECRET` add a "Continue with 1Moby
SSO" button for a company OpenID Connect provider (Google Workspace, Microsoft Entra, Keycloak…).
The provider proves who the person is; the account must still have been provisioned here, so
the administrator keeps control of ids and roles. This path is wired but has not been tested
against a live provider.

### 4. Test mode

`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` turns on test mode: clicking the Login ID field suggests three
seeded accounts — an individual contributor, a manager with reports and the HROD administrator —
and picking one fills in the ID and the password from `SEED_DEMO_PASSWORD`. Sign-in still goes
through the normal password check. The password is sent to the browser in this mode, so anyone
who can open the site can sign in as those accounts: set the flag to `false` before real use.

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
                                      └─ Prisma ─ Supavisor ─ PostgreSQL (Supabase)
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

**Administration** — account provisioning and activation links, roles and permissions, the competency framework and
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
2. Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` and `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`
   (optionally `APP_URL`, the origin written into activation links, and `DATABASE_CA_CERT`).
3. `npm run db:migrate` against the production database, then `npm run db:seed` once.

`postinstall` runs `prisma generate`, so the client is built during deployment.

## Project layout

```
prisma/schema.prisma     the domain model
prisma/migrations/       SQL migrations, incl. checks, partial indexes and RLS
prisma/seed.ts           workbook data → database, idempotent
prisma.config.ts         Prisma 7 connection config
scripts/
  generate_framework.py  workbook → TypeScript source data
  dev-db.mjs             local PGlite database
  check-db.ts            health check
src/
  app/                   login, activate, pending, forbidden, and the signed-in app
  server/                guards, queries and server actions
  components/            ui · charts · layout · profile · learning · assessment · admin
  data/                  framework and content, the seed's source
  lib/                   db, auth, permissions, viewer, i18n
docs/                    design brief and the phase briefs
```

## Known limits

- Scheduled announcements publish the next time anyone opens the system after their time, not by a background job.
- `channel` records that something should also be emailed, but no mailer is wired.
- Exports are CSV rather than `.xlsx`; certificates render in the browser, not as PDFs.
- Activation and reset links are handed over by the administrator; no mailer sends them.
