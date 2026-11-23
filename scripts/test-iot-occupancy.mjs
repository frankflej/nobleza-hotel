#!/usr/bin/env node
/**
 * Contract test for the ESP32 occupancy webhook.
 * Posts the exact JSON the board sends:
 *   {"roomNumber": "101", "occupied": true|false}
 * with header x-device-key and Content-Type application/json.
 *
 * Usage (dev server on :3001, HOTEL_ESP32_SECRET in apps/web/.env):
 *   node scripts/test-iot-occupancy.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "apps/web/.env");
const envText = readFileSync(envPath, "utf8");
const raw = envText.match(/^HOTEL_ESP32_SECRET=(.*)$/m)?.[1]?.trim();
const secret = raw?.replace(/^['"]|['"]$/g, "");
if (!secret) {
  console.error("HOTEL_ESP32_SECRET is missing from apps/web/.env");
  process.exit(1);
}

const base = process.env.IOT_TEST_URL ?? "http://127.0.0.1:3001";
const url = `${base.replace(/\/$/, "")}/api/iot/occupancy`;
const exactOccupied = '{"roomNumber": "101", "occupied": true}';
const exactVacant = '{"roomNumber": "101", "occupied": false}';

let failed = 0;

async function post(label, { body, key, contentType = "application/json", expectStatus }) {
  const headers = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (key !== undefined) headers["x-device-key"] = key;
  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  const ok = Array.isArray(expectStatus)
    ? expectStatus.includes(res.status)
    : res.status === expectStatus;
  if (ok) {
    console.log(`ok  ${label} → ${res.status}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label} → ${res.status} (expected ${expectStatus})`, json);
  }
  return { status: res.status, json };
}

const occupied = await post("exact payload occupied=true (2xx)", {
  body: exactOccupied,
  key: secret,
  expectStatus: [200, 201, 202, 204],
});
await post("exact payload occupied=false (2xx)", {
  body: exactVacant,
  key: secret,
  expectStatus: [200, 201, 202, 204],
});
await post("missing device key → 401", {
  body: exactOccupied,
  key: undefined,
  expectStatus: 401,
});
await post("wrong device key → 401", {
  body: exactOccupied,
  key: "not-the-device-key",
  expectStatus: 401,
});
await post("roomNumber as number → 400", {
  body: JSON.stringify({ roomNumber: 101, occupied: true }),
  key: secret,
  expectStatus: 400,
});
await post("occupied as string → 400", {
  body: JSON.stringify({ roomNumber: "101", occupied: "true" }),
  key: secret,
  expectStatus: 400,
});
await post("unknown room → 404", {
  body: '{"roomNumber": "9999", "occupied": true}',
  key: secret,
  expectStatus: 404,
});

if (occupied.status >= 200 && occupied.status < 300) {
  console.log("success body:", occupied.json);
}

if (failed) {
  console.error(`\n${failed} IoT occupancy contract check(s) failed.`);
  process.exit(1);
}
console.log("\nAll IoT occupancy contract checks passed.");
