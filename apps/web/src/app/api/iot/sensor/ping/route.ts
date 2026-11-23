import { NextRequest, NextResponse } from "next/server";
import { db } from "@NOBLEZA/db";
import { deviceKeyMatches } from "@/lib/device-key";

export const dynamic = "force-dynamic";

const SENSOR_TYPES = new Set(["Motion", "Temperature", "Light"]);

/**
 * Legacy PIR webhook. The current ESP32 sketch posts to /api/iot/occupancy
 * instead. This route is kept for older pings and now requires x-device-key.
 *
 * Body: { roomId: number, macAddress: string, isOccupied: boolean, sensorType?: string }
 */
export async function POST(req: NextRequest) {
  if (!deviceKeyMatches(req.headers.get("x-device-key"))) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Invalid device key." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Request body must be JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "Request body must be a JSON object." }, { status: 400 });
  }

  const { roomId, macAddress, isOccupied, sensorType } = body as Record<string, unknown>;
  const parsedRoomId = typeof roomId === "number" ? roomId : typeof roomId === "string" ? Number(roomId) : NaN;
  if (!Number.isInteger(parsedRoomId) || typeof macAddress !== "string" || macAddress.length === 0) {
    return NextResponse.json(
      { success: false, message: "roomId and macAddress are required." },
      { status: 400 },
    );
  }
  if (typeof isOccupied !== "boolean") {
    return NextResponse.json(
      { success: false, message: "isOccupied is required and must be a boolean." },
      { status: 400 },
    );
  }
  const type = typeof sensorType === "string" && SENSOR_TYPES.has(sensorType) ? sensorType : "Motion";

  try {
    const room = await db.room.findUnique({ where: { id: parsedRoomId } });
    if (!room) {
      return NextResponse.json({ success: false, message: "Room not found." }, { status: 404 });
    }

    await db.roomSensor.upsert({
      where: { macAddress },
      update: { lastPing: new Date(), status: "Active", roomId: parsedRoomId },
      create: { roomId: parsedRoomId, sensorType: type as "Motion" | "Temperature" | "Light", macAddress },
    });

    const latestLog = await db.occupancyLog.findFirst({
      where: { roomId: parsedRoomId },
      orderBy: { detectedAt: "desc" },
    });
    const hasChanged = !latestLog || latestLog.occupied !== isOccupied;

    if (hasChanged) {
      await db.occupancyLog.create({ data: { roomId: parsedRoomId, occupied: isOccupied } });
      await db.room.update({
        where: { id: parsedRoomId },
        data: { occupied: isOccupied, lastMotionDetected: new Date(), occupancySource: "PIR" },
      });

      if (!isOccupied) {
        const hour = new Date().getHours();
        const isMorningShift = hour >= 7 && hour < 14;
        if (isMorningShift && (room.status === "Occupied" || latestLog?.occupied)) {
          await db.room.update({ where: { id: parsedRoomId }, data: { status: "Dirty" } });
          const task = await db.housekeepingTask.create({
            data: {
              roomId: parsedRoomId,
              description: `[AUTO] Sensor detected guest departure from Room ${room.roomNumber}. Cleaning required.`,
              status: "Pending",
            },
          });
          await db.housekeepingLog.create({
            data: {
              roomId: parsedRoomId,
              taskId: task.id,
              action: "MarkedDirty",
              triggeredBy: "sensor",
              notes: `PIR sensor (MAC: ${macAddress}) detected vacancy. Room auto-marked Dirty.`,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sensor data received.",
      occupancyChanged: hasChanged,
      newStatus: isOccupied ? "Occupied" : "Empty",
    });
  } catch (error) {
    console.error("IoT sensor ping error:", error);
    return NextResponse.json(
      { success: false, message: "Server error processing sensor data." },
      { status: 500 },
    );
  }
}
