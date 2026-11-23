# Nobleza Hotel

Hotel management system for Nobleza Hotel: guest reservations, reception, housekeeping, manager forecasts, and administration. Built as a pnpm / Turborepo monorepo with Next.js (App Router), tRPC, Better-Auth, Prisma, and PostgreSQL, following the same layout as Intore.

ESP32 motion sensors report occupancy to `POST /api/iot/occupancy`. A separate Python service can produce demand forecasts.

## App layout

```
apps/web                 Next.js app (dev: http://localhost:3001)
packages/api             tRPC routers
packages/auth            Better-Auth
packages/db              Prisma schema, client, and seed
packages/env             Zod-checked environment variables
packages/config          Shared TypeScript config
python_ai_service        FastAPI demand prediction (local)
IoT_ESP32                Arduino sketch (secrets stay out of git)
```

## Local setup

1. Install Node 22+, pnpm 10, Python 3.10+, and PostgreSQL.
2. Create a database, for example `nobleza_hotel`.
3. Copy `apps/web/.env.example` to `apps/web/.env` and fill in local values (see PLACEHOLDERS.md).
4. Install and seed:

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

Optional AI service:

```bash
cd python_ai_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# If SQLAlchemy 2.1+ asks for psycopg: pip install 'psycopg[binary]'
uvicorn main:app --host 127.0.0.1 --port 8000
```

Do not re-run `pnpm db:seed` on a database that already has bookings; it will skip extras if bookings exist, but users/rooms are upserted.

## Deploy (Vercel)

This repo is Vercel-ready (`vercel.json`, including a 5-minute cron for auto-vacancy). Creating the Vercel project is left to you. You will need to:

- Connect `frankflej/nobleza-hotel` to Vercel, root directory the repo root, Next.js app at `apps/web`.
- Set the production environment variables listed in PLACEHOLDERS.md.
- Provision a pooled Postgres URL (`DATABASE_URL`) and run `pnpm db:push` (or a migrate command) against production once.
- Note: Vercel Hobby plans only allow daily crons; a 5-minute schedule needs a Pro plan.
- The Python AI service currently does **not** fit a Vercel Python function because of package size. Forecasts still run locally. Production hosting for that service is an open decision.

## Licence

Private hotel software. All rights reserved.
