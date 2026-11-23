import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@NOBLEZA/db";
import { env } from "@NOBLEZA/env/server";
import { sendHotelEmail } from "./mail";

const trustedOrigins = [
  env.CORS_ORIGIN,
  env.BETTER_AUTH_URL,
  ...(env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
].filter((v, i, a) => a.indexOf(v) === i);

export const auth = betterAuth({
  appName: "Nobleza Hotel",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const sent = await sendHotelEmail({
        to: user.email,
        subject: "Reset your Nobleza Hotel password",
        html: `<p>Hello ${user.name || "there"},</p>
<p>You requested a password reset for your Nobleza Hotel account.</p>
<p><a href="${url}">Reset your password</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
      });
      if (!sent && env.NODE_ENV !== "production") {
        console.log(`[auth] Password reset link for ${user.email}: ${url}`);
      }
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "guest",
        input: false,
        required: false,
      },
      status: {
        type: "string",
        defaultValue: "active",
        input: false,
        required: false,
      },
      loyaltyPoints: {
        type: "number",
        defaultValue: 0,
        input: false,
        required: false,
      },
      forcePasswordChange: {
        type: "boolean",
        defaultValue: false,
        input: false,
        required: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  plugins: [nextCookies()],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (user && user.status !== "active") {
            throw new Error("Your account has been deactivated.");
          }
          return { data: session };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
