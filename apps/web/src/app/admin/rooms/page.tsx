"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

const TYPES = ["Standard", "Deluxe", "Suite", "Presidential"] as const;
const STATUSES = ["Available", "Occupied", "Dirty", "Cleaning", "Maintenance"] as const;

export default function AdminRoomsPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery(trpc.rooms.list.queryOptions());
  const createRoom = useMutation(trpc.rooms.create.mutationOptions());
  const updateRoom = useMutation(trpc.rooms.update.mutationOptions());
  const deleteRoom = useMutation(trpc.rooms.delete.mutationOptions());

  const [roomNumber, setRoomNumber] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Standard");
  const [price, setPrice] = useState("120");
  const [capacity, setCapacity] = useState("2");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: trpc.rooms.list.queryKey() });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await createRoom.mutateAsync({
        roomNumber,
        type,
        price: Number(price),
        capacity: Number(capacity),
        description: description || undefined,
      });
      setRoomNumber("");
      setDescription("");
      setNotice(`Room ${roomNumber} created.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room.");
    }
  }

  async function savePrice(id: number, nextPrice: string) {
    const value = Number(nextPrice);
    if (!Number.isFinite(value) || value <= 0) return;
    setError(null);
    try {
      await updateRoom.mutateAsync({ id, price: value });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the room.");
    }
  }

  async function saveStatus(id: number, status: (typeof STATUSES)[number]) {
    setError(null);
    try {
      await updateRoom.mutateAsync({ id, status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the room.");
    }
  }

  async function onDelete(id: number, label: string) {
    if (!confirm(`Delete room ${label}? This fails if the room still has bookings.`)) return;
    setError(null);
    try {
      await deleteRoom.mutateAsync({ id });
      setNotice(`Deleted room ${label}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the room.");
    }
  }

  return (
    <div className="space-y-6">
      {notice && <p className="rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <form onSubmit={onCreate} className="rounded-2xl border border-hotel-gold-light bg-white p-5">
        <h2 className="font-serif text-lg">Add a room</h2>
        <p className="mt-1 text-sm text-slate-600">Inventory here is still placeholder until the real rooms and rates are supplied.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <input required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Number" className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className="rounded border border-slate-200 px-3 py-2 text-sm">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input required type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input required type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-1" />
          <button type="submit" disabled={createRoom.isPending} className="rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream disabled:opacity-60">
            {createRoom.isPending ? "Saving…" : "Add room"}
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-2xl border border-hotel-gold-light bg-white">
        {rooms.isLoading && <p className="p-6 text-sm">Loading rooms…</p>}
        {rooms.error && <p className="p-6 text-sm text-hotel-accent-red">{rooms.error.message}</p>}
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-hotel-cream text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.data?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.roomNumber}</td>
                <td className="px-4 py-2">{r.type}</td>
                <td className="px-4 py-2">
                  <input
                    defaultValue={String(r.price)}
                    type="number"
                    min="1"
                    step="0.01"
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                    onBlur={(e) => {
                      if (e.target.value !== String(r.price)) savePrice(r.id, e.target.value);
                    }}
                  />
                </td>
                <td className="px-4 py-2">{r.capacity}</td>
                <td className="px-4 py-2">
                  <select value={r.status} onChange={(e) => saveStatus(r.id, e.target.value as (typeof STATUSES)[number])} className="rounded border border-slate-200 px-2 py-1 text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => onDelete(r.id, r.roomNumber)} className="text-xs text-hotel-accent-red underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
