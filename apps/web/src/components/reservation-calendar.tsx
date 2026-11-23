"use client";

import { useMemo, useState } from "react";

type CalendarBooking = {
  id: number;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

type StatusStyle = { bg: string; text: string; border: string; dot: string };
const BOOKED_STYLE: StatusStyle = { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", dot: "bg-blue-500" };
const STATUS_COLORS: Record<string, StatusStyle> = {
  Booked: BOOKED_STYLE,
  CheckedIn: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  CheckedOut: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  Cancelled: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-400" },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(iso: string) {
  const parts = iso.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

function statusColors(status: string): StatusStyle {
  return STATUS_COLORS[status] ?? BOOKED_STYLE;
}

export function ReservationCalendar({ bookings = [] }: { bookings?: CalendarBooking[] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<CalendarBooking | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function bookingsForDay(day: number | null) {
    if (!day) return [];
    const cell = new Date(year, month, day);
    return bookings.filter((b) => {
      if (b.status === "Cancelled") return false;
      const ci = parseDate(b.checkInDate);
      const co = parseDate(b.checkOutDate);
      return ci <= cell && co > cell;
    });
  }

  const monthSummary = useMemo(() => {
    const summary = { Booked: 0, CheckedIn: 0, CheckedOut: 0, Cancelled: 0 };
    for (const b of bookings) {
      const ci = parseDate(b.checkInDate);
      if (ci.getMonth() === month && ci.getFullYear() === year && summary[b.status as keyof typeof summary] !== undefined) {
        summary[b.status as keyof typeof summary]++;
      }
    }
    return summary;
  }, [bookings, month, year]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(monthSummary).map(([status, count]) => {
          const colors = statusColors(status);
          return (
            <div key={status} className={`${colors.bg} ${colors.border} rounded-xl border p-3 text-center`}>
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-semibold ${colors.text}`}>{status}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-hotel-gold-light bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="font-serif text-lg">
              {MONTHS[month]} {year}
            </h3>
            <button
              type="button"
              onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-full bg-hotel-gold/15 px-2.5 py-1 text-[11px] font-semibold text-hotel-blue"
            >
              Today
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-medium uppercase text-slate-500">
          {DAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayBookings = bookingsForDay(day);
            const isToday =
              day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <div
                key={i}
                className={`min-h-24 border-b border-r border-slate-100 p-1.5 ${day ? "bg-white" : "bg-slate-50/40"}`}
              >
                {day && (
                  <>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-hotel-blue text-hotel-cream" : ""}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayBookings.slice(0, 3).map((b) => {
                        const colors = statusColors(b.status);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelected(b)}
                            className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${colors.bg} ${colors.text}`}
                          >
                            {b.roomNumber} {b.guestName}
                          </button>
                        );
                      })}
                      {dayBookings.length > 3 && (
                        <p className="text-[10px] text-slate-400">+{dayBookings.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-hotel-gold-light bg-white p-4 text-sm">
          <div className="flex justify-between">
            <h4 className="font-serif text-lg">{selected.guestName}</h4>
            <button type="button" onClick={() => setSelected(null)} className="text-xs">
              Close
            </button>
          </div>
          <p className="mt-1 text-slate-600">
            Room {selected.roomNumber} ({selected.roomType}) · {selected.checkInDate} – {selected.checkOutDate} · {selected.status}
          </p>
        </div>
      )}
    </div>
  );
}
