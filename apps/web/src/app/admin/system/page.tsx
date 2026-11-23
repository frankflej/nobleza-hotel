"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function AdminSystemPage() {
  const monitoring = useQuery({
    ...trpc.admin.monitoring.queryOptions(),
    refetchInterval: 30_000,
  });
  const m = monitoring.data;

  return (
    <div className="space-y-6">
      {monitoring.isLoading && <p className="text-sm">Loading system status…</p>}
      {monitoring.error && <p className="text-sm text-hotel-accent-red">{monitoring.error.message}</p>}
      {m && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Users", m.stats.users],
              ["Rooms", m.stats.rooms],
              ["Bookings", m.stats.bookings],
              ["Payments", m.stats.payments],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-hotel-gold-light bg-white p-5">
                <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 font-serif text-3xl">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-hotel-gold-light bg-white p-6 text-sm">
            <h2 className="font-serif text-lg">Database</h2>
            <p className="mt-2">{m.databaseEngine}</p>
            <p>Size: {m.dbSize}</p>
            <p>Guests with active bookings: {m.activeSessions}</p>
            <h2 className="mt-6 font-serif text-lg">This instance</h2>
            <p className="mt-2 text-slate-600">{m.instance.note}</p>
            <p className="mt-1">Uptime: {m.instance.uptimeSeconds}s</p>
            <p>Memory RSS: {m.instance.memoryRssMb} MB · heap: {m.instance.memoryHeapMb} MB</p>
          </div>
        </>
      )}
    </div>
  );
}
