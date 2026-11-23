# What Frank still needs to supply

The app is branded **Nobleza Hotel**. Anything hotel-specific below is temporary demo data so the system can run. Please replace it before going live.

## Branding and contact

- Legal business name (if different from “Nobleza Hotel”)
- Street address, city, country
- Phone, reservations email, general email, and website domain
- Social links, if any
- Logo and favicon (the “N” mark is a stand-in)
- Hero photograph (`apps/web/src/assets/hero.png` is a placeholder)
- Footer and welcome copy on the landing page

## Rooms and rates

The seed creates **79 placeholder rooms** (40 Standard at $95, 30 Deluxe at $150, 8 Suites at $280, 1 Presidential at $500). Please supply:

- Real room numbers, types, capacities, and nightly rates (and currency)
- Descriptions and amenics for each type
- Photographs (current files in `apps/web/public/rooms/` are placeholders)
- How many rooms of each type you actually have

## Demo accounts (local only)

All use the password `password123`. Change these and use a real email domain:

| Email | Role |
| --- | --- |
| admin@nobleza.hotel | admin |
| manager@nobleza.hotel | manager |
| receptionist@nobleza.hotel | receptionist |
| housekeeping@nobleza.hotel | housekeeping |
| guest@nobleza.hotel | guest |
| david.guest@nobleza.hotel | guest |
| sarah.guest@nobleza.hotel | guest |

## Secrets and production env (never commit these)

Set these in `apps/web/.env` locally, and in Vercel later:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (32+ random characters)
- `BETTER_AUTH_URL` and `CORS_ORIGIN` (the public site URL)
- `HOTEL_ESP32_SECRET`
- `AI_SERVICE_URL` (when the Python service has a public URL)
- `SMTP_USER` / `SMTP_PASS` if you want staff welcome and password-reset emails
- `CRON_SECRET` to protect `/api/cron/auto-vacancy`

For the ESP32, copy `IoT_ESP32/ESP32_Occupancy/secrets.h.example` to `secrets.h` and fill in Wi-Fi, server URL, and the device key.

## Payments

There is no live payment gateway. Folios are recorded as Card, Cash, Mobile Money, or Bank Transfer. Say if you want a processor later.

## Python AI on Vercel

The scikit-learn + pandas stack is larger than Vercel’s ~250MB unzipped Python function limit (measured ~280MB even after stripping caches). Forecasts work locally via `AI_SERVICE_URL`. Options for production will be listed after the app is built; no other host has been chosen.
