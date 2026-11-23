import { managerProcedure, router } from "../index";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const analyticsRouter = router({
  kpis: managerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = todayISO();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);

    const [mtd, totalRooms, occupiedRooms, activeBookings, arrivals, departures] = await Promise.all([
      ctx.db.payment.aggregate({
        where: { status: "Paid", createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      ctx.db.room.count(),
      ctx.db.room.count({ where: { status: "Occupied" } }),
      ctx.db.booking.count({ where: { status: { in: ["Booked", "CheckedIn"] } } }),
      ctx.db.booking.count({
        where: { status: { in: ["Booked", "CheckedIn"] }, checkInDate: new Date(today) },
      }),
      ctx.db.booking.count({
        where: { status: "CheckedIn", checkOutDate: new Date(today) },
      }),
    ]);

    return {
      mtdRevenue: mtd._sum.totalAmount ?? 0,
      currentOccupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      occupiedRooms,
      totalRooms,
      activeBookings,
      arrivalsToday: arrivals,
      departuresToday: departures,
      asOf: today,
      tomorrowISO,
    };
  }),
});
