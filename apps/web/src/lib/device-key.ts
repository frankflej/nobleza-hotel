import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@NOBLEZA/env/server";

export function deviceKeyMatches(provided: string | null) {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(env.HOTEL_ESP32_SECRET).digest();
  return timingSafeEqual(a, b);
}
