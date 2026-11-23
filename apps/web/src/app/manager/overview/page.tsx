"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function ManagerOverviewPage() {
  const kpis = useQuery(trpc.analytics.kpis.queryOptions());
  const data = kpis.data;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Operational snapshot for today. Occupancy and revenue figures use recorded bookings and paid folios — there is no demand forecast or suggested pricing.
      </p>
      {kpis.isLoading && <p className="text-sm">Loading figures…</p>}
      {kpis.error && <p className="text-sm text-hotel-accent-red">{kpis.error.message}</p>}
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            ["MTD revenue", `$${data.mtdRevenue.toFixed(2)}`],
            ["Occupancy", `${data.currentOccupancyRate}%`],
            ["Occupied / total", `${data.occupiedRooms} / ${data.totalRooms}`],
            ["Active bookings", String(data.activeBookings)],
            ["Arrivals today", String(data.arrivalsToday)],
            ["Departures today", String(data.departuresToday)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-hotel-gold-light bg-white p-5">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
              <p className="mt-2 font-serif text-2xl">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
