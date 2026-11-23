"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useSession } from "@/lib/auth-client";
import { SiteHeader } from "@/components/site-header";

type Room = {
  id: number;
  roomNumber: string;
  type: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string | null;
  imageUrl: string | null;
};

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function plusDaysISO(start: string, days: number) {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function LandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [checkIn, setCheckIn] = useState(tomorrowISO());
  const [checkOut, setCheckOut] = useState(plusDaysISO(tomorrowISO(), 2));
  const [capacity, setCapacity] = useState(2);
  const [type, setType] = useState<"" | "Standard" | "Deluxe" | "Suite" | "Presidential">("");
  const [searched, setSearched] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookOk, setBookOk] = useState<string | null>(null);

  const search = useQuery({
    ...trpc.rooms.search.queryOptions({
      checkIn,
      checkOut,
      capacity,
      type: type || undefined,
    }),
    enabled: searched,
  });
  const book = useMutation(trpc.bookings.create.mutationOptions());

  const nights = useMemo(() => {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  async function confirmBooking() {
    if (!bookingRoom) return;
    setBookError(null);
    if (!session?.user) {
      router.push(`/login?next=/`);
      return;
    }
    try {
      const result = await book.mutateAsync({
        roomId: bookingRoom.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      setBookOk(
        `Reservation confirmed. Booking #${result.bookingId}. Total $${result.totalPrice.toFixed(2)}.`,
      );
      setBookingRoom(null);
      search.refetch();
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Could not complete the booking.");
    }
  }

  return (
    <div className="min-h-screen bg-hotel-cream text-hotel-blue">
      <SiteHeader />
      <section className="bg-hotel-blue px-6 py-20 text-center text-hotel-cream">
        <p className="text-sm uppercase tracking-[0.3em] text-hotel-gold">A stay of quiet luxury</p>
        <h1 className="mt-4 font-serif text-5xl text-hotel-gold md:text-6xl">Nobleza Hotel</h1>
        <p className="mx-auto mt-4 max-w-2xl text-hotel-cream/80">
          An elegant address for leisure and business. Location, photography, and contact details below are placeholders until official information is supplied.
        </p>
      </section>

      <section id="rooms" className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-serif text-3xl text-hotel-blue">Find a room</h2>
        <form
          className="mt-6 grid gap-4 rounded-xl border border-hotel-gold-light bg-white p-6 shadow-sm md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSearched(true);
            setBookOk(null);
          }}
        >
          <label className="text-sm">
            Check-in
            <input type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-2 py-2" />
          </label>
          <label className="text-sm">
            Check-out
            <input type="date" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-2 py-2" />
          </label>
          <label className="text-sm">
            Guests
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="mt-1 w-full rounded border border-hotel-gold-light px-2 py-2" />
          </label>
          <label className="text-sm">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 w-full rounded border border-hotel-gold-light px-2 py-2">
              <option value="">Any</option>
              <option>Standard</option>
              <option>Deluxe</option>
              <option>Suite</option>
              <option>Presidential</option>
            </select>
          </label>
          <button type="submit" className="self-end rounded bg-hotel-blue px-4 py-2 text-hotel-cream hover:bg-hotel-gold hover:text-hotel-blue-dark">
            Search
          </button>
        </form>

        {bookOk && <p className="mt-4 rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{bookOk} You can review it in your dashboard.</p>}
        {searched && search.isLoading && <p className="mt-6 text-sm">Searching available rooms…</p>}
        {searched && search.error && <p className="mt-6 text-sm text-hotel-accent-red">{search.error.message}</p>}
        {searched && search.data && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {search.data.length === 0 && <p>No rooms match those dates. Try different dates or a different room type.</p>}
            {search.data.map((room) => (
              <article key={room.id} className="overflow-hidden rounded-xl border border-hotel-gold-light bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={room.imageUrl || "/rooms/standard.png"} alt={`${room.type} room ${room.roomNumber}`} className="h-48 w-full object-cover" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-xl">{room.type}</h3>
                      <p className="text-sm text-hotel-blue/70">Room {room.roomNumber} · up to {room.capacity} guests</p>
                    </div>
                    <p className="font-medium text-hotel-gold-dark">
                      ${room.price.toFixed(0)}
                      <span className="block text-xs font-normal text-hotel-blue/60">per night</span>
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-hotel-blue/80">{room.description}</p>
                  {room.amenities && <p className="mt-2 text-xs text-hotel-blue/60">{room.amenities}</p>}
                  <p className="mt-3 text-xs text-hotel-blue/50">Placeholder inventory and rates — replace with official room data.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingRoom(room);
                      setBookError(null);
                    }}
                    className="mt-4 w-full rounded bg-hotel-blue py-2 text-hotel-cream hover:bg-hotel-gold hover:text-hotel-blue-dark"
                  >
                    Book this room
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="about" className="bg-white px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif text-3xl">About the hotel</h2>
          <p className="mt-4 max-w-3xl text-hotel-blue/80">
            Nobleza Hotel offers thoughtfully appointed rooms, attentive service, and a calm setting for overnight stays and longer visits. Full history, amenities, and neighborhood details will appear here once official copy is supplied.
          </p>
        </div>
      </section>

      <footer id="contact" className="bg-hotel-blue px-6 py-10 text-sm text-hotel-cream/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 md:flex-row md:justify-between">
          <div>
            <p className="font-serif text-lg text-hotel-gold">Nobleza Hotel</p>
            <p className="mt-2">Address: [PLACEHOLDER — supply street, city, country]</p>
            <p>Phone: [PLACEHOLDER — supply phone]</p>
            <p>Email: [PLACEHOLDER — supply public email]</p>
          </div>
          <p className="self-end text-hotel-cream/50">Demo site. Replace placeholder contact details before launch.</p>
        </div>
      </footer>

      {bookingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hotel-blue/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-hotel-cream p-6 shadow-xl">
            <h3 className="font-serif text-2xl">Confirm reservation</h3>
            <p className="mt-2 text-sm">
              {bookingRoom.type} · Room {bookingRoom.roomNumber}
              <br />
              {checkIn} to {checkOut} ({nights} night{nights === 1 ? "" : "s"})
              <br />
              Total ${ (bookingRoom.price * nights).toFixed(2) }
            </p>
            <p className="mt-3 text-xs text-hotel-blue/60">
              Payment is not collected here. Your reservation is confirmed and can be settled at the hotel. No card numbers are requested.
            </p>
            {!session?.user && (
              <p className="mt-3 text-sm">You will be asked to sign in or register before the booking is created.</p>
            )}
            {bookError && <p className="mt-3 text-sm text-hotel-accent-red">{bookError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setBookingRoom(null)} className="rounded px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={book.isPending}
                onClick={confirmBooking}
                className="rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream disabled:opacity-60"
              >
                {book.isPending ? "Booking…" : session?.user ? "Confirm booking" : "Sign in to book"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
