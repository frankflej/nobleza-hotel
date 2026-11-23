import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@NOBLEZA/db";
import { env } from "@NOBLEZA/env/server";

export const dynamic = "force-dynamic";

function keysMatch(provided: string, expected: string) {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const deviceKey = req.headers.get("x-device-key") ?? "";
  if (!deviceKey || !keysMatch(deviceKey, env.HOTEL_ESP32_SECRET)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Invalid device key." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const { roomNumber, occupied } = body as { roomNumber?: unknown; occupied?: unknown };

  if (typeof roomNumber !== "string" || roomNumber.length === 0) {
    return NextResponse.json(
      { success: false, message: "roomNumber is required and must be a string." },
      { status: 400 },
    );
  }
  if (typeof occupied !== "boolean") {
    return NextResponse.json(
      { success: false, message: "occupied is required and must be a boolean." },
      { status: 400 },
    );
  }

  try {
    const room = await db.room.findUnique({ where: { roomNumber } });
    if (!room) {
      return NextResponse.json({ success: false, message: "Room not found." }, { status: 404 });
    }

    // Same 3-tier behaviour as the original app: Available / Maintenance stay idle
    // (still 2xx so the board treats the post as successful).
    if (room.status === "Available" || room.status === "Maintenance") {
      return NextResponse.json({
        success: true,
        message: "Monitoring inactive. Room is vacant.",
      });
    }

    const detectionTime = new Date();
    await db.room.update({
      where: { id: room.id },
      data: {
        occupied,
        lastMotionDetected: detectionTime,
        occupancySource: "PIR",
      },
    });

    if (room.status === "Occupied") {
      await db.occupancyLog.create({
        data: {
          roomId: room.id,
          occupied,
          detectedAt: detectionTime,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Occupancy updated successfully." });
  } catch (error) {
    console.error("Update occupancy error:", error);
    return NextResponse.json(
      { success: false, message: "Server error processing occupancy data." },
      { status: 500 },
    );
  }
}
