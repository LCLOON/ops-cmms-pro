# OpsCMMSPro

Computerized Maintenance Management System for hydroelectric operations — asset registry, work orders, preventive maintenance, inventory, purchasing, compliance, and reporting.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and SQLite (better-sqlite3).

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

The SQLite database lives in a persistent per-user directory, deliberately outside the project tree so the dev server's file watcher never fights with SQLite WAL/SHM files:

- Windows: `%LOCALAPPDATA%\ops-cmms-pro\ops-cmms-pro.db`
- macOS/Linux: `${XDG_DATA_HOME:-~/.local/share}/ops-cmms-pro/ops-cmms-pro.db`
- Override with the `OPS_CMMS_DB_PATH` environment variable
- On Vercel (serverless) it falls back to `/tmp` (ephemeral)

To reset the demo data: stop the server, delete the `.db`, `-wal`, and `-shm` files, and restart — schema and seed data regenerate on the next request.

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
