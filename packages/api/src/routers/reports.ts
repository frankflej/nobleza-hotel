import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { managerProcedure, router } from "../index";

const reportType = z.enum(["occupancy", "revenue", "audit"]);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}
function parseDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

export const reportsRouter = router({
  list: managerProcedure
    .input(z.object({ type: reportType.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.report.findMany({
        where: input?.type ? { type: input.type } : {},
        include: { generator: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        generatedBy: r.generator.name,
        generatorRole: r.generator.role,
        data: r.data,
        createdAt: r.createdAt,
      }));
    }),

  generate: managerProcedure
    .input(
      z.object({
        type: reportType,
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const start = input.startDate ? parseDay(input.startDate) : startOfMonth();
      const end = input.endDate ? parseDay(input.endDate) : new Date();
      if (end < start) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End date must be on or after the start date." });
      }

      let reportData: Record<string, unknown> = {};

      if (input.type === "occupancy") {
        const totalRooms = await ctx.db.room.count();
        const stays = await ctx.db.booking.findMany({
          where: {
            status: { in: ["CheckedIn", "CheckedOut", "Booked"] },
            checkInDate: { lte: end },
            checkOutDate: { gte: start },
          },
          select: { checkInDate: true, checkOutDate: true, roomId: true, status: true },
        });
        const dailyOccupancy: {
          date: string;
          occupiedRooms: number;
          totalRooms: number;
          occupancyRate: number;
        }[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          const dateStr = isoDate(cursor);
          const occupiedOnDay = new Set(
            stays
              .filter((b) => {
                if (b.status === "Cancelled") return false;
                const ci = new Date(b.checkInDate);
                const co = new Date(b.checkOutDate);
                return ci <= cursor && co > cursor;
              })
              .map((b) => b.roomId),
          ).size;
          dailyOccupancy.push({
            date: dateStr,
            occupiedRooms: occupiedOnDay,
            totalRooms,
            occupancyRate: totalRooms > 0 ? parseFloat(((occupiedOnDay / totalRooms) * 100).toFixed(1)) : 0,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        const avg =
          dailyOccupancy.reduce((s, d) => s + d.occupancyRate, 0) / Math.max(1, dailyOccupancy.length);
        reportData = {
          period: { start: isoDate(start), end: isoDate(end) },
          totalRooms,
          avgOccupancyRate: parseFloat(avg.toFixed(1)),
          totalBookings: stays.length,
          dailyOccupancy,
        };
      } else if (input.type === "revenue") {
        const payments = await ctx.db.payment.findMany({
          where: { status: "Paid", createdAt: { gte: start, lte: end } },
          include: { booking: { select: { room: { select: { type: true } } } } },
        });
        const totalRevenue = payments.reduce((s, p) => s + p.totalAmount, 0);
        const byMethod: Record<string, number> = {};
        const byRoomType: Record<string, number> = {};
        for (const p of payments) {
          byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] ?? 0) + p.totalAmount;
          const rtype = p.booking.room.type;
          byRoomType[rtype] = (byRoomType[rtype] ?? 0) + p.roomCharges;
        }
        reportData = {
          period: { start: isoDate(start), end: isoDate(end) },
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalRoomCharges: parseFloat(payments.reduce((s, p) => s + p.roomCharges, 0).toFixed(2)),
          totalServiceCharges: parseFloat(payments.reduce((s, p) => s + p.serviceCharges, 0).toFixed(2)),
          totalTax: parseFloat(payments.reduce((s, p) => s + p.tax, 0).toFixed(2)),
          transactionCount: payments.length,
          avgTransactionValue:
            payments.length > 0 ? parseFloat((totalRevenue / payments.length).toFixed(2)) : 0,
          byPaymentMethod: byMethod,
          byRoomType,
        };
      } else {
        const logs = await ctx.db.auditLog.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
        const byAction: Record<string, number> = {};
        for (const l of logs) byAction[l.action] = (byAction[l.action] ?? 0) + 1;
        reportData = {
          period: { start: isoDate(start), end: isoDate(end) },
          totalEntries: logs.length,
          byAction,
          topActions: Object.entries(byAction)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10),
          entries: logs.map((l) => ({
            id: l.id,
            user: l.user?.name ?? "System",
            role: l.user?.role ?? "system",
            action: l.action,
            details: l.details,
            timestamp: l.createdAt,
          })),
        };
      }

      const report = await ctx.db.report.create({
        data: {
          generatedBy: ctx.session.user.id,
          type: input.type,
          data: reportData as object,
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "REPORT_GENERATE",
          details: `Generated ${input.type} report for ${isoDate(start)} to ${isoDate(end)}.`,
        },
      });

      return {
        id: report.id,
        type: report.type,
        data: reportData,
        createdAt: report.createdAt,
      };
    }),
});
