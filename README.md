# OpsCMMSPro

Computerized Maintenance Management System for hydroelectric operations — asset registry, work orders, preventive maintenance, inventory, purchasing, compliance, and reporting.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and SQLite via libSQL (`@libsql/client` — local file in development, remote [Turso](https://turso.tech) database in production).

## Getting Started

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

Dashboard & analytics (KPIs, MTTR/MTBF, cost trends) · Assets (table + hierarchy) · Work Orders (labor, parts, status workflow) · PM Schedules (auto work-order generation, deferrals) · Inventory · Vendors · Purchase Orders · Compliance · Inspections · Electrical tests · Safety · Documents · Meter readings · Admin (sites, users, roles)

## Roles

| Role | Capabilities |
| --- | --- |
| Admin | Full access, user management, deletions |
| Manager | CRUD on all entities, analytics |
| Technician | Edit work orders, record labor, update PMs |
| Viewer | Read-only |
