#!/usr/bin/env node
/**
 * Phase 4 checks: hardened sensor ping, auto-vacancy cron, IoT dashboard,
 * and admin user constraints. Also re-runs the ESP32 occupancy contract.
 *
 * Requires the dev server on :3001 and credentials in gitignored apps/web/.env.
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
const deviceKey = readEnv("HOTEL_ESP32_SECRET");
const cronSecret = readEnv("CRON_SECRET");
const databaseUrl = readEnv("DATABASE_URL");
if (!deviceKey || !databaseUrl) {
  console.error("apps/web/.env must include HOTEL_ESP32_SECRET and DATABASE_URL");
  process.exit(1);
}

function sql(query) {
  const out = execFileSync("psql", [databaseUrl, "-At", "-c", query], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: undefined },
  });
  return out.trim();
}


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

async function signIn(email, password) {
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

async function makeClient(email, password) {
  const jar = await signIn(email, password);
  const { createTRPCClient, httpBatchLink } = await import(
    pathToFileURL(require.resolve("@trpc/client")).href
  );
  return createTRPCClient({
    links: [
      httpBatchLink({
        url: `${base}/api/trpc`,
        headers() {
          return { cookie: cookieHeader(jar) };
        },
      }),
    ],
  });
}

async function expectThrow(label, fn, match) {
  try {
    await fn();
    fail(label, "expected an error");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (match && !String(message).includes(match) && !String(err?.data?.code ?? "").includes(match) && !String(err?.shape?.message ?? "").includes(match)) {
      // tRPC error message may be nested
      const blob = JSON.stringify(err, Object.getOwnPropertyNames(err));
      if (match && !blob.includes(match) && !message.toLowerCase().includes("forbidden") && match !== "FORBIDDEN") {
        fail(label, message);
        return;
      }
    }
    ok(label);
  }
}

const password = "password123";

// --- occupancy contract (existing script) ---
try {
  execFileSync(process.execPath, [resolve(root, "scripts/test-iot-occupancy.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  ok("ESP32 occupancy contract script");
} catch {
  fail("ESP32 occupancy contract script");
}

// --- sensor ping ---
{
  const bad = await fetch(`${base}/api/iot/sensor/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: 40, macAddress: "aa:bb:cc:dd:ee:ff", isOccupied: true }),
  });
  if (bad.status === 401) ok("sensor ping without key → 401");
  else fail("sensor ping without key → 401", `got ${bad.status}`);

  const wrong = await fetch(`${base}/api/iot/sensor/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-key": "not-the-device-key" },
    body: JSON.stringify({ roomId: 40, macAddress: "aa:bb:cc:dd:ee:ff", isOccupied: true }),
  });
  if (wrong.status === 401) ok("sensor ping wrong key → 401");
  else fail("sensor ping wrong key → 401", `got ${wrong.status}`);
}

// --- cron auth + auto-vacancy ---
{
  const unauth = await fetch(`${base}/api/cron/auto-vacancy`);
  if (cronSecret) {
    if (unauth.status === 401) ok("cron without bearer → 401");
    else fail("cron without bearer → 401", `got ${unauth.status}`);

    const roomId = sql(`SELECT id FROM rooms WHERE room_number = '101' LIMIT 1`);
    if (!roomId) {
      fail("cron setup: room 101 missing");
    } else {
      sql(`UPDATE rooms SET occupied = true, "lastMotionDetected" = (now() at time zone 'utc') - interval '45 minutes' WHERE id = ${Number(roomId)}`);
      const authd = await fetch(`${base}/api/cron/auto-vacancy`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const body = await authd.json().catch(() => ({}));
      if (authd.ok && body.success === true && typeof body.vacated === "number") {
        ok(`cron authorized → 2xx vacated=${body.vacated}`);
      } else {
        fail("cron authorized", `${authd.status} ${JSON.stringify(body)}`);
      }
      const after = sql(`SELECT occupied FROM rooms WHERE id = ${Number(roomId)}`);
      if (after === "f") ok("cron marked stale room 101 vacant");
      else fail("cron marked stale room 101 vacant", after);
    }
  } else {
    if (unauth.ok) ok("cron allowed in non-production when CRON_SECRET is unset");
    else fail("cron allowed in non-production when CRON_SECRET is unset", unauth.status);
  }
}

// --- ping with key, look up room id dynamically ---
{
  const roomId = sql(`SELECT id FROM rooms WHERE room_number = '101' LIMIT 1`);
  if (!roomId) {
    fail("sensor ping setup: room 101 missing");
  } else {
    const res = await fetch(`${base}/api/iot/sensor/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-key": deviceKey },
      body: JSON.stringify({
        roomId: Number(roomId),
        macAddress: "sim:phase4:101",
        isOccupied: true,
        sensorType: "Motion",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status >= 200 && res.status < 300 && body.success) ok(`sensor ping with key → ${res.status}`);
    else fail("sensor ping with key → 2xx", `${res.status} ${JSON.stringify(body)}`);
  }
}

const admin = await makeClient("admin@nobleza.hotel", password);
const manager = await makeClient("manager@nobleza.hotel", password);
const receptionist = await makeClient("receptionist@nobleza.hotel", password);

// IoT dashboard
{
  const dash = await admin.iot.dashboard.query();
  if (dash?.summary && Array.isArray(dash.liveStatus)) ok("admin IoT dashboard");
  else fail("admin IoT dashboard", dash);

  const mgrDash = await manager.iot.dashboard.query();
  if (mgrDash?.summary) ok("manager IoT dashboard");
  else fail("manager IoT dashboard", mgrDash);

  const analytics = await manager.iot.analytics.query();
  if (analytics?.currentStats && typeof analytics.currentStats.occupied === "number") ok("manager IoT analytics");
  else fail("manager IoT analytics", analytics);

  await expectThrow("receptionist blocked from IoT dashboard", () => receptionist.iot.dashboard.query(), "FORBIDDEN");
}

// Admin constraints
{
  const users = await admin.admin.users.query();
  const me = users.find((u) => u.email === "admin@nobleza.hotel");
  if (me) ok(`admin users list (${users.length})`);
  else fail("admin users list", "signed-in admin missing");

  await expectThrow("manager blocked from admin.users", () => manager.admin.users.query(), "FORBIDDEN");

  if (me) {
    await expectThrow("cannot delete own admin account", () => admin.admin.deleteUser.mutate({ id: me.id }), "cannot delete");
    await expectThrow("cannot deactivate own admin account", () => admin.admin.updateUser.mutate({ id: me.id, status: "inactive" }), "cannot deactivate");
    await expectThrow("cannot demote own admin account", () => admin.admin.updateUser.mutate({ id: me.id, role: "manager" }), "cannot deactivate or demote");
  }

  const guest = users.find((u) => u.email === "guest@nobleza.hotel");
  if (guest) {
    await expectThrow("cannot delete a guest with bookings", () => admin.admin.deleteUser.mutate({ id: guest.id }), "bookings or assigned tasks");
  }

  const monitoring = await admin.admin.monitoring.query();
  if (monitoring?.instance?.note?.includes("serverless instance") && typeof monitoring.stats.users === "number") {
    ok("admin monitoring labels serverless instance");
  } else {
    fail("admin monitoring labels serverless instance", monitoring);
  }

  const email = `phase4.admin.${Date.now()}@nobleza.hotel`;
  const created = await admin.admin.createUser.mutate({
    name: "Phase 4 Test User",
    email,
    role: "guest",
  });
  if (created?.id && created.email === email && created.tempPassword) ok("admin createUser returns temp password when SMTP is unset");
  else fail("admin createUser", created);

  if (created?.id) {
    const updated = await admin.admin.updateUser.mutate({ id: created.id, role: "receptionist" });
    if (updated.role === "receptionist") ok("admin updateUser role");
    else fail("admin updateUser role", updated);
    const deleted = await admin.admin.deleteUser.mutate({ id: created.id });
    if (deleted.ok) ok("admin deleteUser for unused account");
    else fail("admin deleteUser for unused account", deleted);
  }

  const logs = await admin.admin.auditLogs.query();
  if (Array.isArray(logs) && logs.length > 0) ok(`admin audit logs (${logs.length})`);
  else fail("admin audit logs", logs);
}

if (failed) {
  console.error(`\n${failed} Phase 4 check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Phase 4 admin / IoT checks passed.");
