# OpsCMMSPro

Computerized Maintenance Management System for hydroelectric operations — asset registry, work orders, preventive maintenance, inventory, purchasing, compliance, and reporting.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and SQLite via libSQL (`@libsql/client` — local file in development, remote [Turso](https://turso.tech) database in production).

## Getting Started

### Optional EHS Procedure References

The EHS control on a work-order row opens a separate read-only procedure view.
An admin/manager can preview and attach one current published EHS revision to the
saved work order. Other active users may read it. This does not create checklist
steps, authorize work, check contractors, release isolation, or change asset status.

**Pre-start gate.** When the pilot is configured and a work order already has a pinned
procedure, moving that work order into `in_progress` is refused if the work order's
recorded context (site, asset, title, description, assignee, type) has changed since the
procedure was reviewed. The check is local only — it makes no network call, so an EHS
outage can never look like approval and a reachable EHS server is never required to start
work. It reports; it never edits the job. Jobs with no pinned procedure, and work orders
outside the configured site, are unaffected.

**Contractor gate.** With `OPS_CONTRACTOR_EVIDENCE_ENABLED=1`, a work order bound to a
contractor ID also asks Contractor Management whether that company is clear, and refuses
the transition into `in_progress` when it is not — suspended, disqualified, approved over
blocking findings, or with missing/expired approval or insurance. A source outage blocks
by default. `OPS_CONTRACTOR_GATE_MODE=advisory` logs instead of blocking and is meant for
a planned outage or a staged rollout. Unbound work orders are never gated.

The work order ID is sent as the job reference, and the job's named workers are checked
too: a bound job also cannot start when no worker is assigned to it in Contractor
Management, or when an assigned worker is inactive, has missing or expired training, or
has not acknowledged the job. Assign workers there, using the work order ID as the job
reference, before enabling this gate.

The pilot is disabled unless both `OPS_PROCEDURE_PILOT_ENABLED` and
`OPS_PROCEDURE_DEDICATED_CUSTOMER_CONFIRMED` are `1`. Enable only after verifying a
dedicated single-customer deployment/database pair, durable storage, matching sites,
backups, real authentication and separate environment credentials. Mixed-customer
databases are unsupported; configuration labels do not establish tenant isolation.

Both apps require the same server-only `OPS_PROCEDURE_PILOT_MAPPING` JSON object
with exactly `customerId`, `ehsInstanceId`, `cmmsInstanceId`, `ehsSiteId`, `cmmsSiteId`.
Both also need `OPS_PROCEDURE_READ_TOKEN`, a dedicated random credential of at least
32 characters (not a session or scheduler secret). CMMS requires
`OPS_EHS_PROCEDURE_ORIGIN`, a fixed HTTPS origin without credentials, path or query.
Only non-production loopback origins may use HTTP. No browser receives this token.

The retained attachment contains the exact revision, digest and selection provenance.
It is never replaced when a newer revision is published. Open views refresh every
30 seconds while visible, and on focus/reconnection; this is a last-check observation,
not continuous synchronization. Missing/changed/retired sources and failed checks are
explicit. A network outage preserves already displayed text with an unverified warning;
browser reload while disconnected is not an offline-document storage guarantee.
Scope, asset and assignee changes require planner review. Wrong-site access is rejected.
Attachment requires the same work-order context shown in the preview, rechecked after
the source request. Failed audit writes roll back the attachment.

Schema initialization additively creates `wo_ehs_procedure_attachments` and
`ehs_procedure_binding`, with update/delete protection and transactional audit.
First use binds the database to the configured mapping. There is no replacement,
removal, remapping or review-acknowledgment workflow in this pilot. Deleted work orders
do not delete retained evidence. Back up before deploying. Do not remove the immutability
triggers to resolve a warning; investigate it with the responsible planner instead.

Verification commands:

```powershell
node --test tests/ehs-procedures.test.mjs
npm run test:e2e -- --config playwright.procedure.config.ts
```

The acceptance config expects the EHS checkout at `../ops-ehs-pro`, starts loopback
servers on 3131/3132 without reusing existing servers, and overrides remote database
settings with unique temporary databases. It verifies A remains attached after B,
mapping/role/origin rejection, responsive display, offline warnings and checklist gates.
Synthetic database artifacts remain under the OS temporary directory with the prefix
`ops-procedure-pilot-`; screenshots are under `test-results/procedure-pilot`.
These local checks do not establish production readiness or suite-wide safety.

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in at `/app`. The database is created and seeded automatically on first run.

### Seeded accounts

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `Admin2025!CMMS` | Administrator |
| `manager` | `Manager2025!CMMS` | Maintenance Manager |
| `technician` | `Tech2025!CMMS` | Lead Technician |
| `viewer` | `Viewer2025!CMMS` | Read-only |

Change these before any real deployment. Sessions are JWT-based (8h) and require `JWT_SECRET` in `.env.local`.

## Database

Database resolution order:

1. `TURSO_DATABASE_URL` (+ `TURSO_AUTH_TOKEN`) — remote libSQL/Turso. Use this in production and on Vercel for durable data.
2. `OPS_CMMS_DB_PATH` — explicit local file override.
3. On Vercel without Turso env vars — `/tmp` file. It works, but each serverless instance has its own ephemeral copy, so data resets.
4. Otherwise — persistent per-user data directory, deliberately outside the project tree so the dev server's file watcher never fights with SQLite WAL/SHM files:
   - Windows: `%LOCALAPPDATA%\ops-cmms-pro\ops-cmms-pro.db`
   - macOS/Linux: `${XDG_DATA_HOME:-~/.local/share}/ops-cmms-pro/ops-cmms-pro.db`

Schema and seed data are created automatically on first run. To reset the demo data: stop the server, delete the `.db`, `-wal`, and `-shm` files, and restart.

## Deploying to Vercel

For durable data on Vercel, point the app at a hosted libSQL database (Turso):

```bash
# 1. One-time: install the Turso CLI and sign up / log in
npm install -g turso
turso auth signup        # or: turso auth login

# 2. Create the database and get its URL + token
turso db create ops-cmms-pro
turso db show ops-cmms-pro --url
turso db tokens create ops-cmms-pro

# 3. Set the environment variables on Vercel (both environments)
vercel env add TURSO_DATABASE_URL production   # libsql://... from step 2
vercel env add TURSO_AUTH_TOKEN production     # token from step 2

# 4. Redeploy
vercel --prod
```

Also set `JWT_SECRET` on Vercel — the app refuses to start a production session without it.

Without `TURSO_DATABASE_URL` the app still deploys and runs on Vercel (demo mode): every serverless instance gets its own throwaway `/tmp` database that resets.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck (no test runner is configured) |

## Modules

Dashboard & analytics (KPIs, MTTR/MTBF, cost trends) · Assets (table, hierarchy, printable QR tags) · Work Orders (labor, parts, status workflow, linked Safety Permits) · PM Schedules · Procedures · Inventory · Vendors · Purchase Orders · Compliance · Inspections · Testing (electrical and mechanical) · Oil Analysis (bearing and transformer lab results, trends, corrective-work links) · Safety · Documents · Meter readings · Admin (sites, users, roles)

## Roles

| Role | Capabilities |
| --- | --- |
| Admin | Full access, user management, deletions |
| Manager | CRUD on all entities, analytics |
| Technician | Edit work orders, record labor, update PMs |
| Viewer | Read-only |
