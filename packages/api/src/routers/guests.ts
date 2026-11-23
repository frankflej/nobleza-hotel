import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { frontDeskProcedure, router } from "../index";

function newId() {
  return randomBytes(16).toString("hex");
}

export const guestsRouter = router({
  list: frontDeskProcedure.query(async ({ ctx }) => {
    const guests = await ctx.db.user.findMany({
      where: { role: "guest" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        loyaltyPoints: true,
        createdAt: true,
        bookings: {
          include: {
            room: { select: { roomNumber: true, type: true, price: true } },
            payment: { select: { totalAmount: true, status: true } },
          },
          orderBy: { checkInDate: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return guests.map((guest) => {
      const totalSpent = guest.bookings.reduce((sum, b) => {
        if (b.payment?.status === "Paid") return sum + b.payment.totalAmount;
        return sum;
      }, 0);
      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        status: guest.status,
        loyaltyPoints: guest.loyaltyPoints,
        createdAt: guest.createdAt,
        bookingsCount: guest.bookings.length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        bookings: guest.bookings.map((b) => ({
          id: b.id,
          roomNumber: b.room.roomNumber,
          roomType: b.room.type,
          checkInDate: b.checkInDate.toISOString().slice(0, 10),
          checkOutDate: b.checkOutDate.toISOString().slice(0, 10),
          status: b.status,
          totalPrice: b.totalPrice,
          paymentStatus: b.payment?.status ?? "Unpaid",
        })),
      };
    });
  }),

  create: frontDeskProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A guest with that email already exists.",
        });
      }
      const id = newId();
      const password = await hashPassword(input.password);
      const user = await ctx.db.user.create({
        data: {
          id,
          name: input.name,
          email: input.email,
          emailVerified: true,
          role: "guest",
          status: "active",
          forcePasswordChange: true,
          accounts: {
            create: {
              id: newId(),
              accountId: id,
              providerId: "credential",
              password,
            },
          },
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "GUEST_CREATE",
          details: `Created guest account ${user.email}.`,
        },
      });
      return { id: user.id, name: user.name, email: user.email };
    }),
});
