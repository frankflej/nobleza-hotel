# Nobleza Hotel

Hotel management system for Nobleza Hotel: guest reservations, reception, housekeeping, manager operations, and administration. Built as a pnpm / Turborepo monorepo with Next.js (App Router), tRPC, Better-Auth, Prisma, and PostgreSQL, following the same layout as Intore.

ESP32 motion sensors report occupancy to `POST /api/iot/occupancy`.

There is no AI demand forecast and no Python service. The manager dashboard covers payments, reports, and feedback only.

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

Open [http://localhost:3001](http://localhost:3001). The Next.js app listens on port 3001 in development.

Do not re-run `pnpm db:seed` on a database that already has bookings; it will skip extras if bookings exist, but users and rooms are upserted.

### Local checks

With the dev server running and `HOTEL_ESP32_SECRET` in `apps/web/.env`:

```bash
pnpm check-types
pnpm test:iot          # exact ESP32 occupancy payload
pnpm test:admin-iot    # admin constraints, IoT dashboard, cron, hardened ping
pnpm test:flow         # all roles plus the occupancy contract
pnpm sim:iot -- --once # post occupancy for rooms 101 and 120
```

`pnpm sim:iot` without `--once` keeps posting every 15 seconds. The simulator reads the device key from the gitignored `.env` and never hardcodes it.

## Deploy (Vercel)

This repo is set up for Vercel. Creating the Vercel project and pressing deploy is left to you — do that in the Vercel dashboard against `frankflej/nobleza-hotel`.

### Project settings

When you import the repo, set:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Include files outside the root directory | On (Vercel default for monorepos) |
| Node.js version | 22.x (`engines` in the root `package.json` and `.nvmrc`) |
| Install / Build commands | Leave the defaults from `apps/web/vercel.json`: `cd ../.. && pnpm install` and `cd ../.. && pnpm turbo -F web build` |
| Output Directory | Leave the Next.js default (`.next`) |

Do not set the Root Directory to the repository root. `apps/web/vercel.json` holds the cron and headers, and those only apply when the Root Directory is `apps/web`.

### Environment variables

Set these in Vercel for **Production** (and Preview if you use it). Never commit real values. Full notes are in PLACEHOLDERS.md and `apps/web/.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | 32+ random characters, unique to production |
| `BETTER_AUTH_URL` | Yes | Public HTTPS production URL, no trailing slash |
| `CORS_ORIGIN` | Yes | Same URL as `BETTER_AUTH_URL` |
| `HOTEL_ESP32_SECRET` | Yes | Must match the device key in `secrets.h` on the board |
| `CRON_SECRET` | Yes in production | 16+ random characters. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when this is set |
| `NODE_ENV` | Usually set by Vercel | `production` |
| `SMTP_USER` / `SMTP_PASS` | Optional | Staff welcome and password-reset emails |
| `TRUSTED_ORIGINS` | Optional | Extra comma-separated auth origins |
| `APP_URL` | Optional | Used in emails if you want a URL other than `BETTER_AUTH_URL` |

Use the production domain (for example `https://nobleza-hotel.vercel.app` or your custom domain). Preview URLs are protected by default and will block the ESP32 and some auth callbacks.

### Database

Provision Postgres yourself (Vercel Postgres, Neon, or another host) and put the pooled URL in `DATABASE_URL`. Apply the schema **once from your machine**, not as part of the Vercel build:

```bash
DATABASE_URL="your-production-url" pnpm db:push
```

Do not run `pnpm db:seed` against production. Seed data is demo-only.

### Cron (auto-vacancy)

`GET /api/cron/auto-vacancy` marks rooms vacant when no motion has been reported for 30 minutes. `apps/web/vercel.json` schedules it every five minutes.

- Set `CRON_SECRET` in Vercel. The platform will send the bearer token; the route rejects other callers in production.
- **Vercel Hobby plans only allow a daily cron.** The five-minute schedule needs a Pro plan. On Hobby the job will not run every five minutes; either upgrade, or change the schedule in `apps/web/vercel.json` to a daily expression such as `0 3 * * *` and accept that rooms may stay marked occupied until the daily run.

## ESP32 occupancy

The primary sketch is `IoT_ESP32/ESP32_Occupancy` and talks to Vercel over HTTPS:

```
https://<your-vercel-production-domain>/api/iot/occupancy
```

Use the production domain, not a preview URL. Vercel Deployment Protection on preview deployments blocks unattended devices. If a preview must be used, create a Protection Bypass for Automation secret in the Vercel project and set `VERCEL_PROTECTION_BYPASS` in `secrets.h`; the sketch sends it as `x-vercel-protection-bypass` when that value is non-empty. Leave it empty for production.

Copy `IoT_ESP32/ESP32_Occupancy/secrets.h.example` to `secrets.h` (gitignored) and fill in Wi-Fi, the production URL, and `HOTEL_ESP32_SECRET`. Never commit `secrets.h`.

For local/LAN testing, use `IoT_ESP32/ESP32_Occupancy_HTTP` against `http://YOUR_LAN_IP:3001/api/iot/occupancy`. See `IoT_ESP32/README.md` for the request contract and `pnpm test:iot` to post the exact board payload.

A legacy `POST /api/iot/sensor/ping` route exists for older pings and now requires the same `x-device-key`. New boards should use `/api/iot/occupancy`.

## Licence

Private hotel software. All rights reserved.
