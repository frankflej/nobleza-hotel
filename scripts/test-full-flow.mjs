#!/usr/bin/env node
/**
 * Final full-flow check for every hotel role, plus the exact ESP32
 * occupancy payload. Requires the dev server on :3001 and demo
 * accounts from the local seed (see PLACEHOLDERS.md).
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/web/package.json"));

function readEnv(name) {
  const text = readFileSync(resolve(root, "apps/web/.env"), "utf8");
  const raw = text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  return raw?.replace(/^['"]|['"]$/g, "");
}

const base = (process.env.IOT_TEST_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const origin = (readEnv("CORS_ORIGIN") || "http://localhost:3001").replace(/\/$/, "");
const password = "password123";

let failed = 0;
function ok(label) {
  console.log(`ok  ${label}`);
}
function fail(label, detail) {
  failed += 1;
  console.error(`FAIL ${label}`, detail ?? "");
}

function cookieHeader(jar) {
  return jar.map((c) => c.split(";")[0]).join("; ");
}

function errorText(err) {
  const parts = [
    err instanceof Error ? err.message : String(err),
    err?.data?.code,
    err?.shape?.message,
    err?.shape?.data?.code,
  ];
  return parts.filter(Boolean).join(" ");
}

async function expectThrow(label, fn, match) {
  try {
    await fn();
    fail(label, "expected an error");
  } catch (err) {
    const blob = errorText(err).toLowerCase();
    const expected = String(match || "forbidden").toLowerCase();
    const allowed = blob.includes(expected) || blob.includes("forbidden") || blob.includes("not allowed") || blob.includes("unauthorized");
    if (!allowed) fail(label, errorText(err));
    else ok(label);
  }
}

async function signIn(email) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/login`,
    },
    body: JSON.stringify({ email, password }),
  });
  const jar = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`sign-in failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  }
  return jar;
}

async function makeClient(email) {
  const jar = await signIn(email);
  const { createTRPCClient, httpBatchLink } = await import(
    pathToFileURL(require.resolve("@trpc/client")).href
  );
  const client = createTRPCClient({
    links: [
      httpBatchLink({
        url: `${base}/api/trpc`,
        headers() {
          return { cookie: cookieHeader(jar) };
        },
      }),
    ],
  });
  return { client, jar };
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// --- public pages and health ---
{
  const home = await fetch(`${base}/`);
  if (home.ok) ok(`GET / → ${home.status}`);
  else fail("GET /", home.status);
  const login = await fetch(`${base}/login`);
  if (login.ok) ok(`GET /login → ${login.status}`);
  else fail("GET /login", login.status);
}

// --- ESP32 occupancy contract ---
try {
  execFileSync(process.execPath, [resolve(root, "scripts/test-iot-occupancy.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  ok("ESP32 occupancy contract");
} catch {
  fail("ESP32 occupancy contract");
}

const checkIn = new Date();
checkIn.setUTCDate(checkIn.getUTCDate() + 120);
const checkOut = new Date(checkIn);
checkOut.setUTCDate(checkOut.getUTCDate() + 2);
const checkInStr = ymd(checkIn);
const checkOutStr = ymd(checkOut);

// --- guest ---
{
  const { client: guest } = await makeClient("guest@nobleza.hotel");
  const me = await guest.user.me.query();
  if (me?.role === "guest" && me.email === "guest@nobleza.hotel") ok("guest session");
  else fail("guest session", me);

  const available = await guest.rooms.search.query({ checkIn: checkInStr, checkOut: checkOutStr });
  if (Array.isArray(available) && available.length > 0) ok(`guest room search (${available.length} open)`);
  else fail("guest room search", available);

  const bookings = await guest.bookings.list.query();
  if (Array.isArray(bookings)) ok(`guest bookings list (${bookings.length})`);
  else fail("guest bookings list", bookings);

  const mine = await guest.feedback.mine.query();
  if (Array.isArray(mine)) ok("guest feedback (mine)");
  else fail("guest feedback (mine)", mine);

  await expectThrow("guest blocked from payments", () => guest.payments.list.query(), "FORBIDDEN");
  await expectThrow("guest blocked from admin", () => guest.admin.users.query(), "FORBIDDEN");

  const room = available[0];
  if (room) {
    const created = await guest.bookings.create.mutate({
      roomId: room.id,
      checkInDate: checkInStr,
      checkOutDate: checkOutStr,
    });
    if (created?.bookingId) {
      ok(`guest booked room ${room.roomNumber} (#${created.bookingId})`);
      const cancelled = await guest.bookings.cancel.mutate({ id: created.bookingId });
      if (cancelled?.ok) ok("guest cancelled the test booking");
      else fail("guest cancelled the test booking", cancelled);
    } else {
      fail("guest create booking", created);
    }
  }
}

// --- receptionist ---
{
  const { client: desk } = await makeClient("receptionist@nobleza.hotel");
  const me = await desk.user.me.query();
  if (me?.role === "receptionist") ok("receptionist session");
  else fail("receptionist session", me);

  const rooms = await desk.rooms.list.query();
  const guests = await desk.guests.list.query();
  const bookings = await desk.bookings.list.query();
  if (rooms?.length && guests?.length && Array.isArray(bookings)) {
    ok(`receptionist rooms (${rooms.length}), guests (${guests.length}), bookings (${bookings.length})`);
  } else {
    fail("receptionist lists", { rooms: rooms?.length, guests: guests?.length, bookings: bookings?.length });
  }
  await expectThrow("receptionist blocked from KPIs", () => desk.analytics.kpis.query(), "FORBIDDEN");
  await expectThrow("receptionist blocked from IoT dashboard", () => desk.iot.dashboard.query(), "FORBIDDEN");
  await expectThrow("receptionist blocked from admin", () => desk.admin.users.query(), "FORBIDDEN");
}

// --- housekeeping ---
{
  const { client: hk } = await makeClient("housekeeping@nobleza.hotel");
  const me = await hk.user.me.query();
  if (me?.role === "housekeeping") ok("housekeeping session");
  else fail("housekeeping session", me);

  const tasks = await hk.housekeeping.tasks.query();
  if (Array.isArray(tasks)) ok(`housekeeping tasks (${tasks.length} open)`);
  else fail("housekeeping tasks", tasks);

  await expectThrow("housekeeping blocked from payments", () => hk.payments.list.query(), "FORBIDDEN");
  await expectThrow("housekeeping blocked from admin", () => hk.admin.users.query(), "FORBIDDEN");
}

// --- manager ---
{
  const { client: manager } = await makeClient("manager@nobleza.hotel");
  const me = await manager.user.me.query();
  if (me?.role === "manager") ok("manager session");
  else fail("manager session", me);

  const kpis = await manager.analytics.kpis.query();
  if (typeof kpis?.mtdRevenue === "number" && typeof kpis.occupiedRooms === "number") {
    ok(`manager KPIs (MTD ${kpis.mtdRevenue}, occupied ${kpis.occupiedRooms}/${kpis.totalRooms})`);
  } else {
    fail("manager KPIs", kpis);
  }
  const payments = await manager.payments.list.query({});
  if (Array.isArray(payments?.payments)) ok(`manager payments (${payments.payments.length})`);
  else fail("manager payments", payments);

  const reports = await manager.reports.list.query({});
  if (Array.isArray(reports) || Array.isArray(reports?.reports) || reports) ok("manager reports list");
  else fail("manager reports list", reports);

  const iot = await manager.iot.dashboard.query();
  if (iot?.summary) ok("manager IoT dashboard");
  else fail("manager IoT dashboard", iot);

  const feedback = await manager.feedback.list.query();
  if (Array.isArray(feedback)) ok(`manager feedback (${feedback.length})`);
  else fail("manager feedback", feedback);

  await expectThrow("manager blocked from admin users", () => manager.admin.users.query(), "FORBIDDEN");
}

// --- admin ---
{
  const { client: admin } = await makeClient("admin@nobleza.hotel");
  const me = await admin.user.me.query();
  if (me?.role === "admin") ok("admin session");
  else fail("admin session", me);

  const users = await admin.admin.users.query();
  const monitoring = await admin.admin.monitoring.query();
  const logs = await admin.admin.auditLogs.query();
  const iot = await admin.iot.dashboard.query();
  if (users?.length && monitoring?.stats && Array.isArray(logs) && iot?.summary) {
    ok(`admin users (${users.length}), audit (${logs.length}), monitoring, IoT`);
  } else {
    fail("admin dashboards", { users: users?.length, logs: logs?.length, monitoring, iot: Boolean(iot?.summary) });
  }
}

if (failed) {
  console.error(`\n${failed} full-flow check(s) failed.`);
  process.exit(1);
}
console.log("\nAll role and ESP32 full-flow checks passed.");
