"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { ReservationCalendar } from "@/components/reservation-calendar";

export default function ReceptionCalendarPage() {
  const bookings = useQuery(trpc.bookings.list.queryOptions());
  return (
    <div>
      {bookings.isLoading && <p className="text-sm">Loading calendar…</p>}
      {bookings.error && <p className="text-sm text-hotel-accent-red">{bookings.error.message}</p>}
      {bookings.data && <ReservationCalendar bookings={bookings.data} />}
    </div>
  );
}
