# What Frank still needs to supply

The app is branded **Nobleza Hotel**. Anything hotel-specific below is temporary demo data so the system can run. Please replace it before going live.

## Branding and contact

- Legal business name (if different from “Nobleza Hotel”)
- Street address, city, country
- Phone, reservations email, general email, and website domain
- Social links, if any
- Logo and favicon (the “N” mark is a stand-in)
- Hero photograph (`apps/web/src/assets/hero.jpg` is an Unsplash stock photo)
- Landing page address, phone and email are realistic samples for the demo (Kicukiro, Rwanda), not real contact details

## Rooms and rates

The seed creates **79 placeholder rooms** (40 Standard at $95, 30 Deluxe at $150, 8 Suites at $280, 1 Presidential at $500). Please supply:

- Real room numbers, types, capacities, and nightly rates (and currency)
- Descriptions and amenities for each type
- Photographs (current files in `apps/web/public/rooms/` are placeholders)
- How many rooms of each type you actually have

## Demo accounts (local only)

All use the password `password123`. Change these and use a real email domain:

| Email                      | Role         |
| -------------------------- | ------------ |
| admin@nobleza.hotel        | admin        |
| manager@nobleza.hotel      | manager      |
| receptionist@nobleza.hotel | receptionist |
| housekeeping@nobleza.hotel | housekeeping |
| guest@nobleza.hotel        | guest        |
| david.guest@nobleza.hotel  | guest        |
| sarah.guest@nobleza.hotel  | guest        |

## Secrets and production env (never commit these)

Set these in `apps/web/.env` locally, and in Vercel later:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (32+ random characters)
- `BETTER_AUTH_URL` and `CORS_ORIGIN` (the public site URL)
- `HOTEL_ESP32_SECRET`
- `SMTP_USER` / `SMTP_PASS` if you want staff welcome and password-reset emails
- `CRON_SECRET` to protect `/api/cron/auto-vacancy` (runs once a day at 03:00 Africa/Kigali / 01:00 UTC)

For the ESP32, copy `IoT_ESP32/ESP32_Occupancy/secrets.h.example` to `secrets.h` and fill in Wi-Fi, the Vercel **production** HTTPS URL (`https://<your-vercel-production-domain>/api/iot/occupancy`), and the device key (`HOTEL_ESP32_SECRET`). Do not use preview URLs; Deployment Protection will block the board. A Protection Bypass for Automation secret is optional and only for previews (`VERCEL_PROTECTION_BYPASS`, sent as `x-vercel-protection-bypass`). For local testing, use `IoT_ESP32/ESP32_Occupancy_HTTP` instead.

## Payments

There is no live payment gateway. Folios are recorded as Card, Cash, Mobile Money, or Bank Transfer. Say if you want a processor later.

## Vercel project (you create this)

Import `frankflej/nobleza-hotel` in the Vercel dashboard. Set the Root Directory to `apps/web`, Node.js 22, and the production environment variables listed above. Do not deploy preview URLs to the ESP32. A live payment processor is still an open question; folios today only record Card, Cash, Mobile Money, or Bank Transfer.
