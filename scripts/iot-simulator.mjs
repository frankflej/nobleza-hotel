#!/usr/bin/env node
/**
 * Local PIR occupancy simulator.
 * Posts the exact ESP32 payload to POST /api/iot/occupancy:
 *   {"roomNumber": "101", "occupied": true|false}
 * with header x-device-key.
 *
 * Reads HOTEL_ESP32_SECRET from the gitignored apps/web/.env.
 * Never hardcode the device key in this file.
 *
 * Usage:
 *   pnpm sim:iot
 *   pnpm sim:iot -- --once
 *   IOT_TEST_URL=http://127.0.0.1:3001 node scripts/iot-simulator.mjs --once --rooms=101,120
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(name) {
  const text = readFileSync(resolve(root, "apps/web/.env"), "utf8");
  const raw = text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  return raw?.replace(/^['"]|['"]$/g, "");
}

const secret = readEnv("HOTEL_ESP32_SECRET");
if (!secret) {
  console.error("HOTEL_ESP32_SECRET is missing from apps/web/.env");
  process.exit(1);
}

const base = (process.env.IOT_TEST_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const url = `${base}/api/iot/occupancy`;
const once = process.argv.includes("--once");
const roomsArg = process.argv.find((a) => a.startsWith("--rooms="));
const rooms = (roomsArg?.slice("--rooms=".length) || "101,120").split(",").map((r) => r.trim()).filter(Boolean);
const intervalMs = 15_000;
const state = Object.fromEntries(rooms.map((r) => [r, false]));

async function ping(roomNumber, occupied) {
  const body = `{"roomNumber": "${roomNumber}", "occupied": ${occupied}}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-key": secret },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  const status = res.ok ? "ok" : "FAIL";
  console.log(`${status} room ${roomNumber} occupied=${occupied} → ${res.status}`, json);
  return res.ok;
}

async function cycle() {
  let allOk = true;
  for (const room of rooms) {
    state[room] = !state[room];
    const ok = await ping(room, state[room]);
    if (!ok) allOk = false;
  }
  return allOk;
}

console.log(`Nobleza Hotel IoT simulator → ${url}`);
console.log(`Rooms: ${rooms.join(", ")}. Posts the exact occupancy payload. ${once ? "One pass." : `Loop every ${intervalMs / 1000}s (Ctrl+C to stop).`}`);

const ok = await cycle();
if (once) process.exit(ok ? 0 : 1);

setInterval(() => {
  cycle().catch((err) => console.error(err));
}, intervalMs);
