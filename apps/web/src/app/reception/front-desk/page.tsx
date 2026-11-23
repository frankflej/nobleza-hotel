"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function FrontDeskPage() {
  const queryClient = useQueryClient();
  const bookings = useQuery(trpc.bookings.list.queryOptions());
  const rooms = useQuery(trpc.rooms.list.queryOptions());
  const guests = useQuery(trpc.guests.list.queryOptions());
  const checkIn = useMutation(trpc.bookings.checkIn.mutationOptions());
  const checkOut = useMutation(trpc.bookings.checkOut.mutationOptions());
  const createBooking = useMutation(trpc.bookings.create.mutationOptions());
  const createGuest = useMutation(trpc.guests.create.mutationOptions());

  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<number | null>(null);
  const [serviceCharges, setServiceCharges] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "Cash" | "MobileMoney" | "BankTransfer">("Card");
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const invoice = useQuery({
    ...trpc.bookings.invoice.queryOptions({ id: invoiceId ?? 0 }),
    enabled: invoiceId != null,
  });

  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [guestId, setGuestId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (bookings.data ?? []).filter((b) => {
      if (!q) return true;
      return (
        b.guestName.toLowerCase().includes(q) ||
        b.guestEmail.toLowerCase().includes(q) ||
        b.roomNumber.toLowerCase().includes(q)
      );
    });
  }, [bookings.data, search]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.bookings.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.rooms.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.guests.list.queryKey() }),
    ]);
  }

  async function onCheckIn(id: number) {
    setError(null);
    try {
      await checkIn.mutateAsync({ id });
      setNotice(`Checked in booking #${id}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed.");
    }
  }

  async function onCheckOut(e: FormEvent) {
    e.preventDefault();
    if (checkoutId == null) return;
    setError(null);
    try {
      const result = await checkOut.mutateAsync({
        id: checkoutId,
        serviceCharges,
        paymentMethod,
      });
      setNotice(`Checked out booking #${checkoutId}. Total $${result.grandTotal.toFixed(2)}.`);
      setCheckoutId(null);
      setServiceCharges(0);
      setInvoiceId(checkoutId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-out failed.");
    }
  }

  async function onWalkIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let targetUserId = guestId;
      if (guestMode === "new") {
        const created = await createGuest.mutateAsync({
          name: newName,
          email: newEmail,
          password: newPassword,
        });
        targetUserId = created.id;
      }
      if (!targetUserId) throw new Error("Select or register a guest.");
      const result = await createBooking.mutateAsync({
        roomId: Number(roomId),
        checkInDate,
        checkOutDate,
        userId: targetUserId,
      });
      setNotice(`Reservation created (booking #${result.bookingId}, $${result.totalPrice.toFixed(2)}). The guest should change their password on first sign-in if this was a new account.`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setRoomId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the reservation.");
    }
  }

  const checkoutBooking = bookings.data?.find((b) => b.id === checkoutId);

  return (
    <div className="space-y-4">
      {notice && <p className="rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-hotel-gold-light bg-white lg:col-span-2">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-lg">Check-in registry</h2>
              <p className="text-xs text-slate-500">Process arrivals and settlements.</p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest or room…"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:w-64"
            />
          </div>
          {bookings.isLoading && <p className="p-6 text-sm">Loading reservations…</p>}
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="sticky top-0 bg-hotel-cream text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.guestName}</div>
                      <div className="text-[11px] text-slate-500">{b.guestEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      {b.roomNumber}
                      <span className="block text-[11px] text-slate-500">{b.roomType}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.checkInDate} → {b.checkOutDate}
                      <span className="block text-[11px] text-slate-500">${b.totalPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">{b.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {b.status === "Booked" && (
                          <button type="button" onClick={() => onCheckIn(b.id)} className="rounded border border-hotel-blue px-2 py-1 text-[11px]">
                            Check in
                          </button>
                        )}
                        {b.status === "CheckedIn" && (
                          <button type="button" onClick={() => { setCheckoutId(b.id); setServiceCharges(0); }} className="rounded border border-hotel-gold-dark px-2 py-1 text-[11px]">
                            Check out
                          </button>
                        )}
                        <button type="button" onClick={() => setInvoiceId(b.id)} className="rounded border border-slate-300 px-2 py-1 text-[11px]">
                          Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={onWalkIn} className="rounded-2xl border border-hotel-gold-light bg-white p-6">
          <h2 className="font-serif text-lg">Walk-in reservation</h2>
          <p className="mt-1 text-xs text-slate-500">Book an existing guest, or register a new one.</p>

          <div className="mt-4 flex gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input type="radio" checked={guestMode === "existing"} onChange={() => setGuestMode("existing")} />
              Existing guest
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={guestMode === "new"} onChange={() => setGuestMode("new")} />
              New guest
            </label>
          </div>

          {guestMode === "existing" ? (
            <label className="mt-3 block text-sm">
              Guest
              <select required value={guestId} onChange={(e) => setGuestId(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2 text-sm">
                <option value="">Select a guest</option>
                {guests.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.email})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="mt-3 block text-sm">
                Full name
                <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
              </label>
              <label className="mt-3 block text-sm">
                Email
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
              </label>
              <label className="mt-3 block text-sm">
                Temporary password
                <input type="text" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
              </label>
              <p className="mt-1 text-[11px] text-slate-500">The guest will be asked to change this password on first sign-in.</p>
            </>
          )}

          <label className="mt-3 block text-sm">
            Room
            <select required value={roomId} onChange={(e) => setRoomId(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2 text-sm">
              <option value="">Select a room</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} · {r.type} · ${r.price} · {r.status}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Check-in
            <input type="date" required value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm">
            Check-out
            <input type="date" required value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
          </label>
          <button
            type="submit"
            disabled={createBooking.isPending || createGuest.isPending}
            className="mt-4 w-full rounded bg-hotel-blue py-2 text-sm text-hotel-cream disabled:opacity-60"
          >
            {createBooking.isPending || createGuest.isPending ? "Saving…" : "Create reservation"}
          </button>
        </form>
      </div>

      {checkoutBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hotel-blue/60 p-4">
          <form onSubmit={onCheckOut} className="w-full max-w-md rounded-xl bg-hotel-cream p-6 shadow-xl">
            <h3 className="font-serif text-2xl">Check out</h3>
            <p className="mt-2 text-sm">
              {checkoutBooking.guestName} · Room {checkoutBooking.roomNumber}
              <br />
              Room charges ${checkoutBooking.totalPrice.toFixed(2)}
            </p>
            <label className="mt-4 block text-sm">
              Service charges
              <input
                type="number"
                min={0}
                step="0.01"
                value={serviceCharges}
                onChange={(e) => setServiceCharges(Number(e.target.value))}
                className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm">
              Payment method
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2"
              >
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="MobileMoney">Mobile money</option>
                <option value="BankTransfer">Bank transfer</option>
              </select>
            </label>
            <p className="mt-3 text-xs text-slate-500">
              Tax is 15% of room + service charges. The room will be marked Dirty for housekeeping.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCheckoutId(null)} className="rounded px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={checkOut.isPending} className="rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream">
                {checkOut.isPending ? "Settling…" : "Complete check-out"}
              </button>
            </div>
          </form>
        </div>
      )}

      {invoiceId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hotel-blue/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-hotel-cream p-6 shadow-xl">
            <div className="flex justify-between">
              <h3 className="font-serif text-2xl">Invoice #{invoiceId}</h3>
              <button type="button" onClick={() => setInvoiceId(null)} className="text-sm">
                Close
              </button>
            </div>
            {invoice.isLoading && <p className="mt-3 text-sm">Loading…</p>}
            {invoice.data && (
              <ul className="mt-4 space-y-1 text-sm">
                <li>{invoice.data.invoice.guestName} · {invoice.data.invoice.guestEmail}</li>
                <li>Room {invoice.data.invoice.roomNumber} ({invoice.data.invoice.roomType})</li>
                <li>{invoice.data.invoice.checkInDate} – {invoice.data.invoice.checkOutDate}</li>
                <li>Room charges: ${invoice.data.invoice.roomCharges.toFixed(2)}</li>
                <li>Service charges: ${invoice.data.invoice.serviceCharges.toFixed(2)}</li>
                <li>Tax: ${invoice.data.invoice.tax.toFixed(2)}</li>
                <li>Total: ${invoice.data.invoice.totalAmount.toFixed(2)} ({invoice.data.invoice.status}{invoice.data.invoice.paymentMethod ? ` · ${invoice.data.invoice.paymentMethod}` : ""})</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
