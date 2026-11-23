import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { housekeepingProcedure, router } from "../index";

const MIN_CLEANING_SECONDS = 60;

const idInput = z
  .object({
    roomId: z.number().int().optional(),
    taskId: z.number().int().optional(),
  })
  .refine((v) => v.roomId != null || v.taskId != null, {
    message: "Provide a roomId or a taskId.",
  });

export const housekeepingRouter = router({
  tasks: housekeepingProcedure.query(({ ctx }) =>
    ctx.db.housekeepingTask.findMany({
      where: { status: { in: ["Pending", "InProgress"] } },
      include: {
        room: { select: { id: true, roomNumber: true, type: true, status: true, occupied: true } },
        assignee: { select: { id: true, name: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  start: housekeepingProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const staffId = ctx.session.user.id;
    const staffName = ctx.session.user.name;

    let task = input.taskId
      ? await ctx.db.housekeepingTask.findUnique({
          where: { id: input.taskId },
          include: { room: true },
        })
      : await ctx.db.housekeepingTask.findFirst({
          where: {
            roomId: input.roomId,
            status: { in: ["Pending", "InProgress"] },
            NOT: { description: { startsWith: "[GUEST REQUEST" } },
          },
          include: { room: true },
          orderBy: { createdAt: "asc" },
        });

    const roomId = task?.roomId ?? input.roomId;
    if (roomId == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room or task not found." });
    }
    const room = task?.room ?? (await ctx.db.room.findUnique({ where: { id: roomId } }));
    if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });

    if (!task) {
      task = await ctx.db.housekeepingTask.create({
        data: {
          roomId: room.id,
          reportedBy: staffId,
          assignedTo: staffId,
          description: `Post-checkout cleaning required for Room ${room.roomNumber}.`,
          status: "InProgress",
        },
        include: { room: true },
      });
    } else {
      task = await ctx.db.housekeepingTask.update({
        where: { id: task.id },
        data: { status: "InProgress", assignedTo: staffId },
        include: { room: true },
      });
    }

    await ctx.db.room.update({
      where: { id: room.id },
      data: { status: "Cleaning" },
    });
    await ctx.db.housekeepingLog.create({
      data: {
        roomId: room.id,
        taskId: task.id,
        action: "CleaningStarted",
        triggeredBy: "manual",
        staffId,
        notes: `${staffName} started cleaning Room ${room.roomNumber}.`,
      },
    });

    return { ok: true, taskId: task.id, roomNumber: room.roomNumber };
  }),

  complete: housekeepingProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const staffId = ctx.session.user.id;
    const staffName = ctx.session.user.name;

    const task = input.taskId
      ? await ctx.db.housekeepingTask.findUnique({
          where: { id: input.taskId },
          include: { room: true },
        })
      : await ctx.db.housekeepingTask.findFirst({
          where: {
            roomId: input.roomId,
            status: "InProgress",
          },
          include: { room: true },
          orderBy: { createdAt: "desc" },
        });

    const room = task?.room
      ?? (input.roomId ? await ctx.db.room.findUnique({ where: { id: input.roomId } }) : null);
    if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room or task not found." });
    if (room.status !== "Cleaning") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This room is not in a cleaning state.",
      });
    }

    const elapsed = (Date.now() - room.updatedAt.getTime()) / 1000;
    if (elapsed < MIN_CLEANING_SECONDS) {
      const remaining = Math.ceil(MIN_CLEANING_SECONDS - elapsed);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cleaning must take at least 1 minute. ${remaining}s remaining.`,
      });
    }

    if (task) {
      await ctx.db.housekeepingTask.update({
        where: { id: task.id },
        data: { status: "Resolved", resolvedAt: new Date(), assignedTo: staffId },
      });
    }

    await ctx.db.room.update({
      where: { id: room.id },
      data: { status: "Available", occupied: false },
    });
    await ctx.db.housekeepingLog.create({
      data: {
        roomId: room.id,
        taskId: task?.id,
        action: "CleaningCompleted",
        triggeredBy: "manual",
        staffId,
        notes: `${staffName} completed cleaning. Room ${room.roomNumber} marked Available.`,
      },
    });

    const managers = await ctx.db.user.findMany({
      where: { role: { in: ["manager", "admin"] }, status: "active" },
      select: { id: true },
    });
    if (managers.length > 0) {
      await ctx.db.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          title: "Room Ready",
          message: `Room ${room.roomNumber} has been cleaned and is now Available.`,
        })),
      });
    }

    return { ok: true, roomNumber: room.roomNumber };
  }),
});
