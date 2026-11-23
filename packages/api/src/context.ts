import type { NextRequest } from "next/server";
import { auth } from "@NOBLEZA/auth";
import { db } from "@NOBLEZA/db";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        loyaltyPoints: true,
        forcePasswordChange: true,
        emailVerified: true,
      },
    });
    if (!user || user.status !== "active") {
      return { session: null, db };
    }
    return {
      session: {
        ...session,
        user: {
          ...session.user,
          ...user,
        },
      },
      db,
    };
  }

  return { session: null, db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
