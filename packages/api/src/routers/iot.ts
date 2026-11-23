import { managerProcedure, router } from "../index";

function cleaningPriority(
  room: { status: string; type: string },
  lastLog?: { detectedAt: Date } | null,
) {
  let score = 0;
  const reasons: string[] = [];
  if (room.status === "Dirty") {
    score += 50;
    reasons.push("Room is marked Dirty");
  }
  const hoursIdle = lastLog
    ? (Date.now() - lastLog.detectedAt.getTime()) / (1000 * 60 * 60)
    : 0;
  if (hoursIdle > 6) {
    score += 30;
    reasons.push("Idle > 6 hours");
  } else if (hoursIdle > 2) {
    score += 15;
    reasons.push("Idle > 2 hours");
  }
  if (room.type === "Presidential") {
    score += 20;
    reasons.push("VIP room priority");
  } else if (room.type === "Suite") {
    score += 10;
    reasons.push("Suite priority");
  }
  let label = "Low";
  if (score >= 70) label = "Critical";
  else if (score >= 50) label = "High";
  else if (score >= 25) label = "Medium";
  return { score, label, reason: reasons.join(" | ") };
}

export const iotRouter = router({
  dashboard: managerProcedure.query(async ({ ctx }) => {
    const rooms = await ctx.db.room.findMany({
      include: {
        sensors: true,
        occupancyLogs: { orderBy: { detectedAt: "desc" }, take: 1 },
        housekeepingTasks: {
          where: { status: { in: ["Pending", "InProgress"] } },
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { roomNumber: "asc" },
    });

    let occupied = 0;
    let empty = 0;
    let dirty = 0;
    let cleaning = 0;
    let available = 0;
    let activeSensors = 0;
    let pendingTasks = 0;

    const liveStatus = rooms.map((room) => {
      activeSensors += room.sensors.filter((s) => s.status === "Active").length;
      if (room.occupied) occupied += 1;
      else empty += 1;
      if (room.status === "Dirty") dirty += 1;
      else if (room.status === "Cleaning") cleaning += 1;
      else if (room.status === "Available") available += 1;
      if (room.housekeepingTasks.length > 0) pendingTasks += 1;
      return {
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type,
        roomStatus: room.status,
        occupancy: room.occupied ? "Occupied" : "Empty",
        hasSensor: room.sensors.length > 0,
        sensorActive: room.sensors.some((s) => s.status === "Active"),
        lastOccupancyUpdate: room.lastMotionDetected ?? room.occupancyLogs[0]?.detectedAt ?? null,
        activeTask: room.housekeepingTasks[0]
          ? {
              id: room.housekeepingTasks[0].id,
              status: room.housekeepingTasks[0].status,
              description: room.housekeepingTasks[0].description,
              assignee: room.housekeepingTasks[0].assignee,
            }
          : null,
        priority: cleaningPriority(room, room.occupancyLogs[0]),
      };
    });

    const [recentLogs, activeTasks] = await Promise.all([
      ctx.db.housekeepingLog.findMany({
        take: 20,
        orderBy: { timestamp: "desc" },
        include: {
          room: { select: { roomNumber: true } },
          staff: { select: { name: true } },
        },
      }),
      ctx.db.housekeepingTask.findMany({
        where: { status: "InProgress" },
        include: {
          room: { select: { roomNumber: true, type: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      summary: {
        totalRooms: rooms.length,
        occupied,
        empty,
        dirty,
        cleaning,
        available,
        activeSensors,
        pendingTasks,
      },
      liveStatus,
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        notes: l.notes,
        triggeredBy: l.triggeredBy,
        timestamp: l.timestamp,
        roomNumber: l.room.roomNumber,
        staffName: l.staff?.name ?? null,
      })),
      activeTasks: activeTasks.map((t) => ({
        id: t.id,
        status: t.status,
        description: t.description,
        roomNumber: t.room.roomNumber,
        roomType: t.room.type,
        assignee: t.assignee,
      })),
    };
  }),

  analytics: managerProcedure.query(async ({ ctx }) => {
    const totalRooms = await ctx.db.room.count();
    const occupiedRoomsCount = await ctx.db.room.count({ where: { occupied: true } });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const logs = await ctx.db.occupancyLog.findMany({
      where: { detectedAt: { gte: sevenDaysAgo } },
      include: { room: { select: { roomNumber: true } } },
      orderBy: { detectedAt: "desc" },
    });
    return {
      currentStats: {
        occupied: occupiedRoomsCount,
        vacant: totalRooms - occupiedRoomsCount,
        totalRooms,
      },
      recentLogCount: logs.length,
      recentLogs: logs.slice(0, 50).map((l) => ({
        id: l.id,
        roomNumber: l.room.roomNumber,
        occupied: l.occupied,
        detectedAt: l.detectedAt,
      })),
    };
  }),
});
