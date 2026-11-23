"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function CrmPage() {
  const guests = useQuery(trpc.guests.list.queryOptions());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (guests.data ?? []).filter(
      (g) => g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q),
    );
  }, [guests.data, query]);

  const selected = filtered.find((g) => g.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <section className="flex h-[700px] flex-col overflow-hidden rounded-2xl border border-hotel-gold-light bg-white lg:col-span-5">
        <div className="space-y-4 border-b border-slate-100 p-6">
          <div>
            <h2 className="font-serif text-lg">Guest directory</h2>
            <p className="text-xs text-slate-500">Search profiles and stay records.</p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
        </div>
        {guests.isLoading && <p className="p-6 text-sm">Loading guests…</p>}
        <ul className="flex-1 overflow-y-auto">
          {filtered.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={`w-full border-b border-slate-100 px-6 py-3 text-left ${
                  selected?.id === g.id ? "bg-hotel-gold/10" : "hover:bg-hotel-cream"
                }`}
              >
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-slate-500">{g.email}</p>
                <p className="text-[11px] text-slate-400">
                  {g.bookingsCount} stay{g.bookingsCount === 1 ? "" : "s"} · ${g.totalSpent.toFixed(2)} paid
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-hotel-gold-light bg-white p-6 lg:col-span-7">
        {!selected && <p className="text-sm text-slate-500">Select a guest to see their stay history.</p>}
        {selected && (
          <>
            <h2 className="font-serif text-2xl">{selected.name}</h2>
            <p className="text-sm text-slate-600">{selected.email}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase text-slate-400">Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-slate-400">Loyalty points</dt>
                <dd>{selected.loyaltyPoints}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-slate-400">Stays</dt>
                <dd>{selected.bookingsCount}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-slate-400">Total paid</dt>
                <dd>${selected.totalSpent.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Preference notes are not stored yet. When official guest-preference fields are ready, they will appear here.
            </p>
            <h3 className="mt-6 font-serif text-lg">Stay history</h3>
            {selected.bookings.length === 0 && <p className="mt-2 text-sm">No reservations on file.</p>}
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2">Room</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {selected.bookings.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="py-2">
                      {b.roomNumber} <span className="text-slate-500">({b.roomType})</span>
                    </td>
                    <td>
                      {b.checkInDate} – {b.checkOutDate}
                    </td>
                    <td>{b.status}</td>
                    <td>${b.totalPrice.toFixed(2)}</td>
                    <td>{b.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
