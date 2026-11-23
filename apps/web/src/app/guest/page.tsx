"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { trpc } from "@/utils/trpc";
import { useSession } from "@/lib/auth-client";

export default function GuestDashboardPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const bookings = useQuery(trpc.bookings.list.queryOptions());
  const feedback = useQuery(trpc.feedback.mine.queryOptions());
  const notifications = useQuery(trpc.notifications.list.queryOptions());
  const cancel = useMutation(trpc.bookings.cancel.mutationOptions());
  const submitFeedback = useMutation(trpc.feedback.submit.mutationOptions());
  const requestService = useMutation(trpc.rooms.createServiceRequest.mutationOptions());
  const markRead = useMutation(trpc.notifications.markRead.mutationOptions());

  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const invoice = useQuery({
    ...trpc.bookings.invoice.queryOptions({ id: invoiceId ?? 0 }),
    enabled: invoiceId != null,
  });
  const [fbTitle, setFbTitle] = useState("");
  const [fbMessage, setFbMessage] = useState("");
  const [fbRating, setFbRating] = useState(5);
  const [svcRoomId, setSvcRoomId] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user;
  const loyalty = user?.loyaltyPoints ?? 0;

  const roomChoices = useMemo(() => {
    const seen = new Set<number>();
    const rows: { id: number; label: string }[] = [];
    for (const b of bookings.data ?? []) {
      if (!seen.has(b.roomId)) {
        seen.add(b.roomId);
        rows.push({ id: b.roomId, label: `${b.roomType} · Room ${b.roomNumber}` });
      }
    }
    return rows;
  }, [bookings.data]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.bookings.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.feedback.mine.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() }),
    ]);
  }

  async function onCancel(id: number) {
    setError(null);
    if (!confirm("Cancel this reservation?")) return;
    try {
      await cancel.mutateAsync({ id });
      setNotice("Reservation cancelled.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
  }

  async function onFeedback(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitFeedback.mutateAsync({
        title: fbTitle,
        message: fbMessage,
        rating: fbRating,
        category: "General",
      });
      setFbTitle("");
      setFbMessage("");
      setNotice("Thank you for your feedback.");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback.");
    }
  }

  async function onService(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await requestService.mutateAsync({ roomId: Number(svcRoomId), description: svcDesc });
      setSvcDesc("");
      setNotice("Service request sent to housekeeping.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    }
  }

  return (
    <AppShell title="Guest dashboard">
      {notice && <p className="mb-4 rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="mb-4 rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <section className="rounded-xl border border-hotel-gold-light bg-white p-6">
        <h2 className="font-serif text-xl">Loyalty</h2>
        <p className="mt-2 text-sm">
          You have <strong>{loyalty}</strong> loyalty points.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-hotel-gold-light bg-white p-6">
        <h2 className="font-serif text-xl">Your reservations</h2>
        {bookings.isLoading && <p className="mt-3 text-sm">Loading…</p>}
        {bookings.data && bookings.data.length === 0 && (
          <p className="mt-3 text-sm">You have no reservations yet. Book a room from the home page.</p>
        )}
        <ul className="mt-4 space-y-3">
          {bookings.data?.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-hotel-gold-light p-4">
              <div>
                <p className="font-medium">
                  {b.roomType} · Room {b.roomNumber}
                </p>
                <p className="text-sm text-hotel-blue/70">
                  {b.checkInDate} to {b.checkOutDate} · {b.status} · ${b.totalPrice.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInvoiceId(b.id)} className="rounded border border-hotel-blue px-3 py-1 text-sm">
                  Invoice
                </button>
                {b.status === "Booked" && (
                  <button type="button" onClick={() => onCancel(b.id)} className="rounded border border-hotel-accent-red px-3 py-1 text-sm text-hotel-accent-red">
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {invoiceId != null && (
          <div className="mt-4 rounded bg-hotel-cream p-4 text-sm">
            <div className="flex justify-between">
              <h3 className="font-medium">Invoice for booking #{invoiceId}</h3>
              <button type="button" onClick={() => setInvoiceId(null)} className="text-xs">
                Close
              </button>
            </div>
            {invoice.isLoading && <p>Loading invoice…</p>}
            {invoice.data && (
              <ul className="mt-2 space-y-1">
                <li>Guest: {invoice.data.invoice.guestName}</li>
                <li>
                  Room: {invoice.data.invoice.roomNumber} ({invoice.data.invoice.roomType})
                </li>
                <li>
                  Dates: {invoice.data.invoice.checkInDate} – {invoice.data.invoice.checkOutDate}
                </li>
                <li>Room charges: ${invoice.data.invoice.roomCharges.toFixed(2)}</li>
                <li>Service charges: ${invoice.data.invoice.serviceCharges.toFixed(2)}</li>
                <li>Tax: ${invoice.data.invoice.tax.toFixed(2)}</li>
                <li>
                  Total: ${invoice.data.invoice.totalAmount.toFixed(2)} ({invoice.data.invoice.status})
                </li>
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-hotel-gold-light bg-white p-6">
        <h2 className="font-serif text-xl">Notifications</h2>
        {notifications.data && notifications.data.length === 0 && <p className="mt-3 text-sm">No notifications yet.</p>}
        <ul className="mt-3 space-y-2 text-sm">
          {notifications.data?.map((n) => (
            <li key={n.id} className={n.read ? "text-hotel-blue/60" : "font-medium"}>
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  if (!n.read) {
                    markRead.mutate({ id: n.id }, { onSuccess: () => refreshAll() });
                  }
                }}
              >
                {n.title}: {n.message}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <form onSubmit={onFeedback} className="rounded-xl border border-hotel-gold-light bg-white p-6">
          <h2 className="font-serif text-xl">Leave feedback</h2>
          <label className="mt-3 block text-sm">
            Title
            <input required value={fbTitle} onChange={(e) => setFbTitle(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm">
            Message
            <textarea required value={fbMessage} onChange={(e) => setFbMessage(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" rows={3} />
          </label>
          <label className="mt-3 block text-sm">
            Rating
            <select value={fbRating} onChange={(e) => setFbRating(Number(e.target.value))} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={submitFeedback.isPending} className="mt-4 rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream">
            Submit feedback
          </button>
          {feedback.data && feedback.data.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-hotel-blue/70">
              {feedback.data.map((f) => (
                <li key={f.id}>
                  {f.title} · {f.rating}/5 {f.staffResponse ? `— staff: ${f.staffResponse}` : ""}
                </li>
              ))}
            </ul>
          )}
        </form>

        <form onSubmit={onService} className="rounded-xl border border-hotel-gold-light bg-white p-6">
          <h2 className="font-serif text-xl">Request service</h2>
          <label className="mt-3 block text-sm">
            Room
            {roomChoices.length > 0 ? (
              <select required value={svcRoomId} onChange={(e) => setSvcRoomId(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2">
                <option value="">Select a room from your reservations</option>
                {roomChoices.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <input required value={svcRoomId} onChange={(e) => setSvcRoomId(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" placeholder="Room id" />
            )}
          </label>
          <label className="mt-3 block text-sm">
            Description
            <textarea required value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" rows={3} />
          </label>
          <button type="submit" disabled={requestService.isPending} className="mt-4 rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream">
            Send request
          </button>
        </form>
      </section>
    </AppShell>
  );
}
