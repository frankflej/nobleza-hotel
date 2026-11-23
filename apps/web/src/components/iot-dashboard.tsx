"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function IoTDashboard() {
  const dashboard = useQuery({
    ...trpc.iot.dashboard.queryOptions(),
    refetchInterval: 20_000,
  });
  const analytics = useQuery({
    ...trpc.iot.analytics.queryOptions(),
    refetchInterval: 10_000,
  });

  const s = dashboard.data?.summary;
  const a = analytics.data?.currentStats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Live occupancy from PIR sensors. The board posts to <code>POST /api/iot/occupancy</code>. This view refreshes every 20 seconds.
        </p>
        <button type="button" onClick={() => { dashboard.refetch(); analytics.refetch(); }} className="text-sm text-hotel-gold-dark hover:underline">
          Refresh
        </button>
      </div>
      {dashboard.error && <p className="text-sm text-hotel-accent-red">{dashboard.error.message}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {[
          ["Rooms", s?.totalRooms],
          ["Motion", a?.occupied ?? s?.occupied],
          ["No motion", a?.vacant ?? s?.empty],
          ["Dirty", s?.dirty],
          ["Cleaning", s?.cleaning],
          ["Available", s?.available],
          ["Sensors", s?.activeSensors],
          ["Open tasks", s?.pendingTasks],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-hotel-gold-light bg-white p-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 font-serif text-2xl">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-2xl border border-hotel-gold-light bg-white">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-hotel-cream text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Motion</th>
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Task</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.data?.liveStatus.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {row.roomNumber}
                  <span className="block text-[11px] text-slate-500">{row.type}</span>
                </td>
                <td className="px-4 py-2">{row.roomStatus}</td>
                <td className="px-4 py-2">{row.occupancy}</td>
                <td className="px-4 py-2">{row.hasSensor ? (row.sensorActive ? "Active" : "Inactive") : "None"}</td>
                <td className="px-4 py-2">
                  {row.priority.label}
                  {row.priority.reason && <span className="block text-[11px] text-slate-500">{row.priority.reason}</span>}
                </td>
                <td className="px-4 py-2 text-[11px]">
                  {row.activeTask ? `${row.activeTask.status}: ${row.activeTask.description}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-hotel-gold-light bg-white p-5">
          <h3 className="font-serif text-lg">Recent housekeeping logs</h3>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {dashboard.data?.recentLogs.map((l) => (
              <li key={l.id}>
                <span className="font-medium">Room {l.roomNumber}</span> · {l.action}
                <span className="block text-[11px] text-slate-500">
                  {l.staffName ?? l.triggeredBy ?? "system"} · {new Date(l.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
            {dashboard.data && dashboard.data.recentLogs.length === 0 && <li className="text-slate-500">No logs yet.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-hotel-gold-light bg-white p-5">
          <h3 className="font-serif text-lg">Recent motion events</h3>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {analytics.data?.recentLogs.map((l) => (
              <li key={l.id}>
                Room {l.roomNumber} · {l.occupied ? "motion" : "no motion"}
                <span className="block text-[11px] text-slate-500">{new Date(l.detectedAt).toLocaleString()}</span>
              </li>
            ))}
            {analytics.data && analytics.data.recentLogs.length === 0 && <li className="text-slate-500">No occupancy logs in the last 7 days.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
