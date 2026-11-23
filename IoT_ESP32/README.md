# ESP32 occupancy sensors

The board talks to the hotel app with a fixed contract. Do not change the path, header names, or JSON shape:

- `POST /api/iot/occupancy`
- Header: `x-device-key` (must equal `HOTEL_ESP32_SECRET` on the server)
- Header: `Content-Type: application/json`
- Body, exactly: `{"roomNumber": "101", "occupied": true}` or `{"roomNumber": "101", "occupied": false}`
  (`roomNumber` is a string, `occupied` is a boolean)
- The server replies with a 2xx status on success
- The sketch sends only on state change: occupied after motion, unoccupied after 10 seconds with no motion

Wi-Fi credentials, the device key, and the server URL live in `secrets.h`. Copy the matching `secrets.h.example` and never commit `secrets.h`.

## Primary sketch (Vercel HTTPS)

Use `ESP32_Occupancy/`. It posts with `WiFiClientSecure` to:

```
https://<your-vercel-production-domain>/api/iot/occupancy
```

Use the **production** domain (for example `nobleza-hotel.vercel.app`, or your custom domain), not a preview URL. Vercel Deployment Protection on preview deployments blocks unattended devices, so a board calling a `*.vercel.app` preview link will usually get an HTML challenge instead of the API.

If you must hit a protected preview, create a Protection Bypass for Automation secret in the Vercel project and put it in `VERCEL_PROTECTION_BYPASS` in `secrets.h`. When that value is non-empty, the sketch sends it as `x-vercel-protection-bypass`. Leave it empty for production.

`secrets.h.example` already includes the public ISRG Root X1 certificate so the board can verify Vercel’s TLS certificate.

## Local HTTP variant

Use `ESP32_Occupancy_HTTP/` against the Next.js app on your network, for example `http://YOUR_LAN_IP:3001/api/iot/occupancy`. Same sensor logic and JSON contract; plain `WiFiClient` (no TLS). This is for local testing only — Vercel does not accept `http://`.

## Contract test

From the repo root, with the dev server running and `HOTEL_ESP32_SECRET` set in `apps/web/.env`:

```bash
node scripts/test-iot-occupancy.mjs
```

The test posts the exact payload the board sends.
