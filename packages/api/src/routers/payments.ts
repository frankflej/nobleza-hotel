import { z } from "zod";
import { managerProcedure, router } from "../index";

const method = z.enum(["Card", "Cash", "MobileMoney", "BankTransfer"]);
const status = z.enum(["Pending", "Paid", "Refunded"]);

export const paymentsRouter = router({
  list: managerProcedure
    .input(
      z
        .object({
          method: method.optional(),
          status: status.optional(),
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const where = {
        ...(input?.method ? { paymentMethod: input.method } : {}),
        ...(input?.status ? { status: input.status } : {}),
      };
      const [rows, total, paid] = await Promise.all([
        ctx.db.payment.findMany({
          where,
          include: {
            booking: {
              include: {
                user: { select: { name: true, email: true } },
                room: { select: { roomNumber: true, type: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.payment.count({ where }),
        ctx.db.payment.aggregate({
          where: { status: "Paid" },
          _sum: { totalAmount: true },
          _count: true,
        }),
      ]);

      return {
        page,
        limit,
        total,
        summary: {
          totalPaid: paid._sum.totalAmount ?? 0,
          totalTransactions: paid._count,
        },
        payments: rows.map((p) => ({
          id: p.id,
          bookingId: p.bookingId,
          guestName: p.booking.user.name,
          guestEmail: p.booking.user.email,
          roomNumber: p.booking.room.roomNumber,
          roomType: p.booking.room.type,
          checkInDate: p.booking.checkInDate.toISOString().slice(0, 10),
          checkOutDate: p.booking.checkOutDate.toISOString().slice(0, 10),
          roomCharges: p.roomCharges,
          serviceCharges: p.serviceCharges,
          tax: p.tax,
          totalAmount: p.totalAmount,
          paymentMethod: p.paymentMethod,
          status: p.status,
          createdAt: p.createdAt,
        })),
      };
    }),
});
