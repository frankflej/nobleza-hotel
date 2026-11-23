import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, frontDeskProcedure, router } from "../index";
import { formatBooking, nightsBetween } from "../lib/booking-format";

const bookingInclude = {
  user: { select: { id: true, name: true, email: true } },
  room: { select: { roomNumber: true, type: true, price: true } },
  payment: true,
} as const;

export const bookingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const where = ctx.session.user.role === "guest" ? { userId: ctx.session.user.id } : {};
    const rows = await ctx.db.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(formatBooking);
  }),

  create: protectedProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        checkInDate: z.string(),
        checkOutDate: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staff = ["receptionist", "manager", "admin"].includes(ctx.session.user.role);
      const targetUserId = staff && input.userId ? input.userId : ctx.session.user.id;
      const room = await ctx.db.room.findUnique({ where: { id: input.roomId } });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });

      const checkIn = new Date(input.checkInDate);
      const checkOut = new Date(input.checkOutDate);
      const nights = nightsBetween(checkIn, checkOut);
      if (nights <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Check-out must be after check-in." });
      }

      const overlapping = await ctx.db.booking.findFirst({
        where: {
          roomId: room.id,
          status: { in: ["Booked", "CheckedIn"] },
          AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
        },
      });
      if (overlapping) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Room is not available for the selected dates.",
        });
      }

      const totalPrice = parseFloat((room.price * nights).toFixed(2));
      const booking = await ctx.db.booking.create({
        data: {
          userId: targetUserId,
          roomId: room.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: "Booked",
          totalPrice,
          loyaltyDiscount: 0,
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "BOOKING_CREATE",
          details: `Booked Room ${room.roomNumber} (${room.type}) for ${input.checkInDate} to ${input.checkOutDate}. Total: $${totalPrice.toFixed(2)}`,
        },
      });
      return { bookingId: booking.id, totalPrice: booking.totalPrice };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findUnique({ where: { id: input.id } });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (booking.status !== "Booked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'Only bookings with status "Booked" can be cancelled.',
        });
      }
      if (ctx.session.user.role === "guest" && booking.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only cancel your own bookings.",
        });
      }
      await ctx.db.booking.update({ where: { id: input.id }, data: { status: "Cancelled" } });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "BOOKING_CANCEL",
          details: `Cancelled booking #${input.id}.`,
        },
      });
      return { ok: true };
    }),

  checkIn: frontDeskProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findUnique({
        where: { id: input.id },
        include: { room: true, user: true },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (booking.status !== "Booked") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This booking cannot be checked in." });
      }
      await ctx.db.$transaction([
        ctx.db.booking.update({ where: { id: booking.id }, data: { status: "CheckedIn" } }),
        ctx.db.room.update({ where: { id: booking.roomId }, data: { status: "Occupied" } }),
        ctx.db.auditLog.create({
          data: {
            userId: ctx.session.user.id,
            action: "CHECK_IN",
            details: `Checked in ${booking.user.name} to Room ${booking.room.roomNumber}.`,
          },
        }),
      ]);
      return { ok: true };
    }),

  checkOut: frontDeskProcedure
    .input(
      z.object({
        id: z.number().int(),
        serviceCharges: z.number().min(0).default(0),
        paymentMethod: z.enum(["Card", "Cash", "MobileMoney", "BankTransfer"]).default("Card"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findUnique({
        where: { id: input.id },
        include: { room: true, payment: true, user: true },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (booking.status !== "CheckedIn") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only checked-in bookings can be checked out." });
      }
      const roomCharges = booking.totalPrice;
      const tax = (roomCharges + input.serviceCharges) * 0.15;
      const totalAmount = parseFloat((roomCharges + input.serviceCharges + tax).toFixed(2));
      await ctx.db.$transaction(async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CheckedOut" } });
        await tx.room.update({ where: { id: booking.roomId }, data: { status: "Dirty" } });
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              roomCharges,
              serviceCharges: input.serviceCharges,
              tax: parseFloat(tax.toFixed(2)),
              totalAmount,
              paymentMethod: input.paymentMethod,
              status: "Paid",
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              roomCharges,
              serviceCharges: input.serviceCharges,
              tax: parseFloat(tax.toFixed(2)),
              totalAmount,
              paymentMethod: input.paymentMethod,
              status: "Paid",
            },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.session.user.id,
            action: "CHECK_OUT",
            details: `Checked out ${booking.user.name} from Room ${booking.room.roomNumber}. Total: $${totalAmount}.`,
          },
        });
      });
      return { grandTotal: totalAmount };
    }),

  invoice: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findUnique({
        where: { id: input.id },
        include: { user: true, room: true, payment: true },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (ctx.session.user.role === "guest" && booking.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only view your own invoices." });
      }
      const roomCharges = booking.payment?.roomCharges ?? booking.totalPrice;
      const serviceCharges = booking.payment?.serviceCharges ?? 0;
      const tax = booking.payment?.tax ?? 0;
      return {
        invoice: {
          bookingId: booking.id,
          guestName: booking.user.name,
          guestEmail: booking.user.email,
          roomNumber: booking.room.roomNumber,
          roomType: booking.room.type,
          checkInDate: booking.checkInDate.toISOString().slice(0, 10),
          checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
          roomCharges,
          serviceCharges,
          tax,
          totalAmount: booking.payment?.totalAmount ?? roomCharges,
          paymentMethod: booking.payment?.paymentMethod ?? null,
          status: booking.payment?.status ?? "Pending",
        },
      };
    }),
});
