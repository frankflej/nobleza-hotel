import dotenv from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

function loadWebEnvOnce(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, "apps", "web", ".env"),
    resolve(cwd, ".env"),
    resolve(__dirname, "..", "..", "..", "apps", "web", ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
  dotenv.config();
}

loadWebEnvOnce();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    CORS_ORIGIN: z.string().url(),
    TRUSTED_ORIGINS: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    HOTEL_ESP32_SECRET: z.string().min(8),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    APP_URL: z.string().url().optional(),
    CRON_SECRET: z.string().min(16).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
