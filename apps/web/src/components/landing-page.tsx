"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useSession } from "@/lib/auth-client";
import { SiteHeader } from "@/components/site-header";
import heroImage from "@/assets/hero.jpg";
import { loaderFor } from "@/lib/image-loader";

export type Room = {
  id: number;
  roomNumber: string;
  type: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string | null;
  imageUrl: string | null;
};

type RoomTypeFilter = "" | "Standard" | "Deluxe" | "Suite" | "Presidential";
type SearchParams = { checkIn: string; checkOut: string; capacity: number; type: RoomTypeFilter };

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

const inputClass =
  "mt-1 w-full rounded border border-hotel-gold-light bg-white px-2 py-2 transition focus:border-hotel-gold focus:outline-none focus:ring-2 focus:ring-hotel-gold/30";

export function LandingPage({ initialRooms }: { initialRooms: Room[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [checkIn, setCheckIn] = useState(tomorrowISO);
  const [checkOut, setCheckOut] = useState(() => plusDaysISO(tomorrowISO(), 2));
  const [capacity, setCapacity] = useState(2);
  const [type, setType] = useState<RoomTypeFilter>("");
  // null until the guest searches: show the pre-rendered rooms instantly.
  const [params, setParams] = useState<SearchParams | null>(null);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookOk, setBookOk] = useState<string | null>(null);

  const query = params ?? { checkIn, checkOut, capacity: 1, type: "" as const };
  const search = useQuery({
    ...trpc.rooms.search.queryOptions({
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      capacity: query.capacity,
      type: query.type || undefined,
    }),
    // Only hit the API after a search, or if the cached page had no rooms.
    enabled: params !== null || initialRooms.length === 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const book = useMutation(trpc.bookings.create.mutationOptions());

  const rooms: Room[] | undefined = params || initialRooms.length === 0 ? search.data : initialRooms;
  const refreshing = search.isFetching && rooms !== undefined;

  // Booking dates come from the last search, falling back to the form.
  const stayIn = params?.checkIn ?? checkIn;
  const stayOut = params?.checkOut ?? checkOut;
  const nights = useMemo(() => {
    const ms = new Date(stayOut).getTime() - new Date(stayIn).getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [stayIn, stayOut]);

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
        checkInDate: stayIn,
        checkOutDate: stayOut,
      });
      setBookOk(
        `Reservation confirmed. Booking #${result.bookingId}. Total $${result.totalPrice.toFixed(2)}.`,
      );
      setBookingRoom(null);
      if (params) search.refetch();
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Could not complete the booking.");
    }
  }

  return (
    <div className="min-h-screen bg-hotel-cream text-hotel-blue">
      <SiteHeader />
      <section className="relative isolate flex h-[calc(100svh-4rem)] max-h-[56rem] min-h-[32rem] items-center justify-center overflow-hidden px-6 py-24 text-center text-hotel-cream">
        <Image
          src={heroImage}
          alt="Nobleza Hotel pool and lobby at dusk"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-hotel-blue-dark/75 via-hotel-blue-dark/55 to-hotel-blue-dark/85" />
        <div className="animate-fade-up">
          <p className="text-sm uppercase tracking-[0.3em] text-hotel-gold">A stay of quiet luxury</p>
          <h1 className="mt-4 font-serif text-5xl text-hotel-gold drop-shadow md:text-7xl">Nobleza Hotel</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-hotel-cream/90">On the shores of Lake Kivu, Rubavu.</p>
          <a
            href="#rooms"
            className="mt-10 inline-block rounded bg-hotel-gold px-8 py-3 text-sm uppercase tracking-[0.2em] text-hotel-blue-dark shadow-gold transition hover:bg-hotel-gold-hover"
          >
            View rooms
          </a>
        </div>
      </section>

      <section id="rooms" className="mx-auto max-w-6xl scroll-mt-4 px-6 py-14">
        <h2 className="font-serif text-3xl text-hotel-blue">Our rooms</h2>
        <form
          className="mt-6 grid gap-4 rounded-xl border border-hotel-gold-light bg-white p-6 shadow-sm md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ checkIn, checkOut, capacity, type });
            setBookOk(null);
          }}
        >
          <label className="text-sm">
            Check-in
            <input
              type="date"
              required
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) setCheckOut(plusDaysISO(e.target.value, 1));
              }}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Check-out
            <input type="date" required min={plusDaysISO(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm">
            Guests
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inputClass} />
          </label>
          <label className="text-sm">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as RoomTypeFilter)} className={inputClass}>
              <option value="">Any</option>
              <option>Standard</option>
              <option>Deluxe</option>
              <option>Suite</option>
              <option>Presidential</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={refreshing}
            className="self-end rounded bg-hotel-blue px-4 py-2 text-hotel-cream transition hover:bg-hotel-gold hover:text-hotel-blue-dark disabled:opacity-70"
          >
            {refreshing ? "Checking…" : "Check availability"}
          </button>
        </form>

        {bookOk && <p className="mt-4 rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{bookOk} You can review it in your dashboard.</p>}
        {search.error && <p className="mt-6 text-sm text-hotel-accent-red">{search.error.message}</p>}

        {rooms === undefined ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-hotel-gold-light bg-white">
                <div className="h-52 animate-pulse bg-hotel-gold-light/50" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-1/2 animate-pulse rounded bg-hotel-gold-light/60" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-hotel-gold-light/40" />
                  <div className="h-9 w-full animate-pulse rounded bg-hotel-gold-light/40" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <p className="mt-8">No rooms free for those dates.</p>
        ) : (
          <div className={`mt-8 grid gap-6 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3 ${refreshing ? "opacity-60" : "opacity-100"}`}>
            {rooms.map((room, i) => (
              <article
                key={room.id}
                className="group overflow-hidden rounded-xl border border-hotel-gold-light bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-luxury"
              >
                <div className="relative h-52 overflow-hidden bg-hotel-gold-light/40">
                  <Image
                    src={room.imageUrl || "/rooms/standard.png"}
                    loader={loaderFor(room.imageUrl || "")}
                    alt={`${room.type} room ${room.roomNumber}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    priority={i < 3}
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
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
                  {room.description && <p className="mt-3 line-clamp-2 text-sm text-hotel-blue/80">{room.description}</p>}
                  {room.amenities && <p className="mt-2 line-clamp-1 text-xs text-hotel-blue/60">{room.amenities}</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setBookingRoom(room);
                      setBookError(null);
                    }}
                    className="mt-4 w-full rounded bg-hotel-blue py-2 text-hotel-cream transition hover:bg-hotel-gold hover:text-hotel-blue-dark"
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
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-3xl">About the hotel</h2>
          <p className="mt-4 max-w-3xl text-hotel-blue/80">
            Calm rooms, lake views and attentive service in Rubavu, a short walk from the Lake Kivu waterfront.
          </p>
        </div>
      </section>

      <footer id="contact" className="bg-hotel-blue px-6 py-10 text-sm text-hotel-cream/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:justify-between">
          <div>
            <p className="font-serif text-lg text-hotel-gold">Nobleza Hotel</p>
            <p className="mt-2">Avenue de la Coopération, Rubavu (Gisenyi), Rwanda</p>
            <p>
              <a href="tel:+250788123456" className="hover:text-hotel-gold">+250 788 123 456</a>
            </p>
            <p>
              <a href="mailto:reservations@noblezahotel.rw" className="hover:text-hotel-gold">reservations@noblezahotel.rw</a>
            </p>
          </div>
          <p className="self-end text-hotel-cream/50">© {new Date().getFullYear()} Nobleza Hotel</p>
        </div>
      </footer>

      {bookingRoom && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-hotel-blue/60 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-xl bg-hotel-cream p-6 shadow-xl">
            <h3 className="font-serif text-2xl">Confirm reservation</h3>
            <p className="mt-2 text-sm">
              {bookingRoom.type} · Room {bookingRoom.roomNumber}
              <br />
              {stayIn} to {stayOut} ({nights} night{nights === 1 ? "" : "s"})
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
