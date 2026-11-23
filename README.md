# Nobleza Hotel

Hotel management system for Nobleza Hotel: guest reservations, reception, housekeeping, manager operations, and administration. Built as a pnpm / Turborepo monorepo with Next.js (App Router), tRPC, Better-Auth, Prisma, and PostgreSQL, following the same layout as Intore.

ESP32 motion sensors report occupancy to `POST /api/iot/occupancy`.

## App layout

```
apps/web                 Next.js app (dev: http://localhost:3001)
packages/api             tRPC routers
packages/auth            Better-Auth
packages/db              Prisma schema, client, and seed
packages/env             Zod-checked environment variables
packages/config          Shared TypeScript config
IoT_ESP32                ESP32 sketches (HTTPS primary; HTTP local variant; secrets stay out of git)
```

## Local setup

1. Install Node 22+, pnpm 10, and PostgreSQL.
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

Do not re-run `pnpm db:seed` on a database that already has bookings; it will skip extras if bookings exist, but users/rooms are upserted.

## Deploy (Vercel)

This repo is Vercel-ready (`vercel.json`, including a 5-minute cron for auto-vacancy). Creating the Vercel project is left to you. You will need to:

- Connect `frankflej/nobleza-hotel` to Vercel, root directory the repo root, Next.js app at `apps/web`.
- Set the production environment variables listed in PLACEHOLDERS.md.
- Provision a pooled Postgres URL (`DATABASE_URL`) and run `pnpm db:push` (or a migrate command) against production once.
- Note: Vercel Hobby plans only allow daily crons; a 5-minute schedule needs a Pro plan.

## ESP32 occupancy

The primary sketch is `IoT_ESP32/ESP32_Occupancy` and talks to Vercel over HTTPS:

```
https://<your-vercel-production-domain>/api/iot/occupancy
```

Use the production domain (for example `nobleza-hotel.vercel.app` or a custom domain), not a preview URL. Vercel Deployment Protection on preview deployments blocks unattended devices. If a preview must be used, create a Protection Bypass for Automation secret in the Vercel project and set `VERCEL_PROTECTION_BYPASS` in `secrets.h`; the sketch sends it as `x-vercel-protection-bypass` when that value is non-empty. Leave it empty for production.

Copy `IoT_ESP32/ESP32_Occupancy/secrets.h.example` to `secrets.h` (gitignored) and fill in Wi-Fi, the production URL, and `HOTEL_ESP32_SECRET`. Never commit `secrets.h`.

For local/LAN testing, use `IoT_ESP32/ESP32_Occupancy_HTTP` against `http://YOUR_LAN_IP:3001/api/iot/occupancy`. See `IoT_ESP32/README.md` for the request contract and `node scripts/test-iot-occupancy.mjs` to post the exact board payload.

## Licence

Private hotel software. All rights reserved.
