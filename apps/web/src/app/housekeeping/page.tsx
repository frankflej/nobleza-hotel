"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { trpc } from "@/utils/trpc";

const MIN_CLEANING_SECONDS = 60;

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery(trpc.rooms.list.queryOptions());
  const tasks = useQuery(trpc.housekeeping.tasks.queryOptions());
  const start = useMutation(trpc.housekeeping.start.mutationOptions());
  const complete = useMutation(trpc.housekeeping.complete.mutationOptions());
  const report = useMutation(trpc.rooms.reportMaintenance.mutationOptions());
  const resolve = useMutation(trpc.rooms.resolveMaintenance.mutationOptions());

  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportRoomId, setReportRoomId] = useState("");
  const [reportDesc, setReportDesc] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.rooms.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.housekeeping.tasks.queryKey() }),
    ]);
  }

  const board = useMemo(() => {
    const list = rooms.data ?? [];
    return {
      dirty: list.filter((r) => r.status === "Dirty"),
      cleaning: list.filter((r) => r.status === "Cleaning"),
      occupied: list.filter((r) => r.status === "Occupied"),
      maintenance: list.filter((r) => r.status === "Maintenance"),
    };
  }, [rooms.data]);

  async function onStart(roomId: number) {
    setError(null);
    try {
      const result = await start.mutateAsync({ roomId });
      setNotice(`Cleaning started for Room ${result.roomNumber}. Stay at least one minute before marking it ready.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start cleaning.");
    }
  }

  async function onComplete(roomId: number) {
    setError(null);
    try {
      const result = await complete.mutateAsync({ roomId });
      setNotice(`Room ${result.roomNumber} is now Available.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete cleaning.");
    }
  }

  async function onReport(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await report.mutateAsync({ roomId: Number(reportRoomId), description: reportDesc });
      setNotice("Maintenance request submitted. The room is marked Maintenance.");
      setReportDesc("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not report maintenance.");
    }
  }

  async function onResolve(id: number) {
    setError(null);
    try {
      await resolve.mutateAsync({ id });
      setNotice("Request resolved. The room is Available again.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the request.");
    }
  }

  const openTasks = tasks.data ?? [];

  return (
    <AppShell title="Housekeeping" allow={["housekeeping", "manager", "admin"]} wide>
      {notice && <p className="mb-4 rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="mb-4 rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Dirty", board.dirty.length],
          ["Cleaning", board.cleaning.length],
          ["Occupied", board.occupied.length],
          ["Maintenance", board.maintenance.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-hotel-gold-light bg-white p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-hotel-gold-light bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg">Cleaning board</h2>
            <p className="text-xs text-slate-500">Dirty and cleaning rooms first, then occupied rooms with live sensor status.</p>
          </div>
          <button type="button" onClick={() => refresh()} className="text-sm text-hotel-gold-dark hover:underline">
            Refresh
          </button>
        </div>
        {rooms.isLoading && <p className="text-sm">Loading rooms…</p>}
        <ul className="space-y-3">
          {[...board.dirty, ...board.cleaning, ...board.occupied].map((room) => {
            const elapsed = Math.floor((now - new Date(room.updatedAt).getTime()) / 1000);
            const remaining = Math.max(0, MIN_CLEANING_SECONDS - elapsed);
            const locked = room.status === "Cleaning" && remaining > 0;
            const monitoringOff = room.status === "Available" || room.status === "Maintenance";
            return (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hotel-gold-light p-4">
                <div>
                  <p className="font-serif text-lg">
                    Room {room.roomNumber} <span className="text-sm font-sans text-slate-500">({room.type})</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase">
                    <span className="rounded border border-slate-200 px-2 py-0.5">{room.status}</span>
                    {monitoringOff ? (
                      <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-500">Monitoring inactive</span>
                    ) : (
                      <span
                        className={`rounded border px-2 py-0.5 ${
                          room.occupied
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-emerald-300 bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {room.status === "Occupied"
                          ? room.occupied
                            ? "Guest monitoring: motion"
                            : "Guest monitoring: no motion"
                          : room.occupied
                            ? "Housekeeping monitoring: motion — do not enter"
                            : "Housekeeping monitoring: empty — safe"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {room.status === "Dirty" && (
                    <button
                      type="button"
                      onClick={() => onStart(room.id)}
                      className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
                    >
                      Start clean
                    </button>
                  )}
                  {room.status === "Cleaning" && (
                    <button
                      type="button"
                      disabled={locked || complete.isPending}
                      onClick={() => onComplete(room.id)}
                      title={locked ? "Cleaning must take at least 1 minute." : "Mark as ready"}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        locked
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {locked ? `Ready in ${remaining}s` : "Mark available"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {board.dirty.length + board.cleaning.length + board.occupied.length === 0 && !rooms.isLoading && (
            <li className="text-sm text-slate-500">No rooms currently need housekeeping attention.</li>
          )}
        </ul>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-hotel-gold-light bg-white p-6">
          <h2 className="font-serif text-lg">Open requests</h2>
          <p className="mt-1 text-xs text-slate-500">Maintenance issues and guest service requests.</p>
          {tasks.isLoading && <p className="mt-3 text-sm">Loading…</p>}
          <ul className="mt-4 space-y-3">
            {openTasks.map((task) => {
              const isGuest = task.description.includes("[GUEST REQUEST");
              const clean = isGuest
                ? task.description.replace(/\[GUEST REQUEST.*?\]\s*/, "")
                : task.description;
              return (
                <li
                  key={task.id}
                  className={`rounded-xl border p-4 ${
                    isGuest ? "border-hotel-gold bg-hotel-gold/10" : "border-hotel-gold-light"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Room {task.room.roomNumber}
                        {isGuest && <span className="ml-2 text-[10px] uppercase tracking-wider text-hotel-gold-dark">Guest service</span>}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{clean}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {task.status}
                        {task.assignee ? ` · assigned to ${task.assignee.name}` : ""}
                        {task.reporter ? ` · reported by ${task.reporter.name}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onResolve(task.id)}
                      className="shrink-0 rounded border border-hotel-blue px-3 py-1 text-xs"
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              );
            })}
            {openTasks.length === 0 && !tasks.isLoading && <li className="text-sm text-slate-500">No open requests.</li>}
          </ul>
        </div>

        <form onSubmit={onReport} className="rounded-2xl border border-hotel-gold-light bg-white p-6">
          <h2 className="font-serif text-lg">Report maintenance</h2>
          <label className="mt-3 block text-sm">
            Room
            <select
              required
              value={reportRoomId}
              onChange={(e) => setReportRoomId(e.target.value)}
              className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2"
            >
              <option value="">Select a room</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} · {r.type} · {r.status}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Description
            <textarea
              required
              minLength={3}
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2"
            />
          </label>
          <button type="submit" disabled={report.isPending} className="mt-4 rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream">
            Submit request
          </button>
        </form>
      </section>
    </AppShell>
  );
}
