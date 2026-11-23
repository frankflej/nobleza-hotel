import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  publicProcedure,
  protectedProcedure,
  managerProcedure,
  adminProcedure,
  staffProcedure,
  housekeepingProcedure,
  router,
} from "../index";

const roomType = z.enum(["Standard", "Deluxe", "Suite", "Presidential"]);
const roomStatus = z.enum(["Available", "Occupied", "Dirty", "Cleaning", "Maintenance"]);

export const roomsRouter = router({
  search: publicProcedure
    .input(
      z.object({
        checkIn: z.string(),
        checkOut: z.string(),
        capacity: z.number().int().positive().optional(),
        type: roomType.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const checkIn = new Date(input.checkIn);
      const checkOut = new Date(input.checkOut);
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Check-in and check-out dates are required.",
        });
      }
      const booked = await ctx.db.booking.findMany({
        where: {
          status: { in: ["Booked", "CheckedIn"] },
          AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
        },
        select: { roomId: true },
      });
      const excluded = booked.map((b) => b.roomId);
      return ctx.db.room.findMany({
        where: {
          id: { notIn: excluded },
          status: { in: ["Available", "Dirty", "Cleaning"] },
          ...(input.capacity ? { capacity: { gte: input.capacity } } : {}),
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: { price: "asc" },
      });
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.room.findMany({ orderBy: { roomNumber: "asc" } }),
  ),

  create: managerProcedure
    .input(
      z.object({
        roomNumber: z.string().min(1),
        type: roomType,
        price: z.number().positive(),
        capacity: z.number().int().positive().default(2),
        description: z.string().optional(),
        amenities: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.db.room.create({ data: input })),

  update: managerProcedure
    .input(
      z.object({
        id: z.number().int(),
        roomNumber: z.string().min(1).optional(),
        type: roomType.optional(),
        price: z.number().positive().optional(),
        capacity: z.number().int().positive().optional(),
        description: z.string().optional(),
        amenities: z.string().optional(),
        imageUrl: z.string().optional(),
        status: roomStatus.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.room.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.room.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  updateStatus: staffProcedure
    .input(z.object({ id: z.number().int(), status: roomStatus }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.room.update({ where: { id: input.id }, data: { status: input.status } }),
    ),

  reportMaintenance: staffProcedure
    .input(z.object({ roomId: z.number().int(), description: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.room.findUnique({ where: { id: input.roomId } });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
      await ctx.db.room.update({ where: { id: room.id }, data: { status: "Maintenance" } });
      return ctx.db.housekeepingTask.create({
        data: {
          roomId: room.id,
          reportedBy: ctx.session.user.id,
          description: input.description,
          status: "Pending",
        },
      });
    }),

  maintenanceList: staffProcedure.query(({ ctx }) =>
    ctx.db.housekeepingTask.findMany({
      where: { status: { in: ["Pending", "InProgress"] } },
      include: {
        room: true,
        reporter: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  resolveMaintenance: housekeepingProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.housekeepingTask.findUnique({ where: { id: input.id } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      await ctx.db.housekeepingTask.update({
        where: { id: task.id },
        data: { status: "Resolved", resolvedAt: new Date() },
      });
      await ctx.db.room.update({ where: { id: task.roomId }, data: { status: "Available" } });
      return { ok: true };
    }),

  createServiceRequest: protectedProcedure
    .input(z.object({ roomId: z.number().int(), description: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.room.findUnique({ where: { id: input.roomId } });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
      return ctx.db.housekeepingTask.create({
        data: {
          roomId: room.id,
          reportedBy: ctx.session.user.id,
          description: `[GUEST REQUEST] Room ${room.roomNumber}: ${input.description}`,
          status: "Pending",
        },
      });
    }),
});
