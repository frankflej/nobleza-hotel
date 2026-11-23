import { PrismaClient } from "@prisma/client";
import { env } from "@NOBLEZA/env/server";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export { Prisma } from "@prisma/client";
export type * from "@prisma/client";
