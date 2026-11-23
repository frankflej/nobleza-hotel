import { NextRequest, NextResponse } from "next/server";
import { db } from "@NOBLEZA/db";
import { env } from "@NOBLEZA/env/server";

export const dynamic = "force-dynamic";

const AUTO_VACANCY_TIMEOUT_MS = 30 * 60 * 1000;

function cronAuthorized(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Marks rooms vacant when no motion has been reported for 30 minutes.
 * Vercel cron: daily at 01:00 UTC (03:00 Africa/Kigali), which fits the Hobby plan.
 * If CRON_SECRET is set, callers must send Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const threshold = new Date(Date.now() - AUTO_VACANCY_TIMEOUT_MS);
    const result = await db.room.updateMany({
      where: {
        occupied: true,
        lastMotionDetected: { lt: threshold },
      },
      data: { occupied: false },
    });
    if (result.count > 0) {
      console.log(`[Auto-Vacancy] Marked ${result.count} rooms as vacant due to inactivity.`);
    }
    return NextResponse.json({ success: true, vacated: result.count });
  } catch (error) {
    console.error("Error in auto-vacancy job:", error);
    return NextResponse.json({ success: false, message: "Auto-vacancy job failed." }, { status: 500 });
  }
}
