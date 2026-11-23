"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { roomStatusClass } from "@/lib/room-status";

export default function ReceptionRoomsPage() {
  const rooms = useQuery(trpc.rooms.list.queryOptions());
  const list = rooms.data ?? [];
  const count = (status: string) => list.filter((r) => r.status === status).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Available", count("Available")],
          ["Occupied", count("Occupied")],
          ["Cleaning / Dirty", count("Cleaning") + count("Dirty")],
          ["Maintenance", count("Maintenance")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-hotel-gold-light bg-white p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </div>
        ))}
      </div>

      {rooms.isLoading && <p className="text-sm">Loading rooms…</p>}
      {rooms.error && <p className="text-sm text-hotel-accent-red">{rooms.error.message}</p>}

      <div className="rounded-2xl border border-hotel-gold-light bg-white p-6">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-serif text-lg">Hotel rooms board</h2>
            <p className="text-xs text-slate-500">Live status of the placeholder inventory.</p>
          </div>
          <button type="button" onClick={() => rooms.refetch()} className="text-sm text-hotel-gold-dark hover:underline">
            Refresh
          </button>
        </div>
        <div className="grid max-h-[520px] grid-cols-2 gap-4 overflow-y-auto pr-1 md:grid-cols-5">
          {list.map((room) => (
            <div
              key={room.id}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 text-center ${roomStatusClass(room.status)}`}
            >
              <div>
                <span className="block text-[10px] uppercase tracking-wider opacity-80">{room.type}</span>
                <h3 className="mt-1 font-serif text-xl">Room {room.roomNumber}</h3>
              </div>
              <div className="border-t border-black/5 pt-2 text-[11px]">
                <span>${room.price} / night</span>
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-widest opacity-80">{room.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
