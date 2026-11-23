"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0] ?? {});
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ManagerPaymentsPage() {
  const [method, setMethod] = useState<"" | "Card" | "Cash" | "MobileMoney" | "BankTransfer">("");
  const [status, setStatus] = useState<"" | "Pending" | "Paid" | "Refunded">("");
  const payments = useQuery(
    trpc.payments.list.queryOptions({
      method: method || undefined,
      status: status || undefined,
      limit: 100,
    }),
  );

  const rows = useMemo(
    () =>
      (payments.data?.payments ?? []).map((p) => ({
        id: p.id,
        guest: p.guestName,
        email: p.guestEmail,
        room: p.roomNumber,
        type: p.roomType,
        checkIn: p.checkInDate,
        checkOut: p.checkOutDate,
        roomCharges: p.roomCharges.toFixed(2),
        serviceCharges: p.serviceCharges.toFixed(2),
        tax: p.tax.toFixed(2),
        total: p.totalAmount.toFixed(2),
        method: p.paymentMethod,
        status: p.status,
      })),
    [payments.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg">Payments</h2>
          {payments.data && (
            <p className="text-xs text-slate-500">
              Paid total ${payments.data.summary.totalPaid.toFixed(2)} across {payments.data.summary.totalTransactions} paid folio{payments.data.summary.totalTransactions === 1 ? "" : "s"}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="rounded border border-hotel-gold-light px-2 py-1 text-sm">
            <option value="">All methods</option>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
            <option value="MobileMoney">Mobile money</option>
            <option value="BankTransfer">Bank transfer</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded border border-hotel-gold-light px-2 py-1 text-sm">
            <option value="">All statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(rows, "nobleza-payments.csv")}
            disabled={!rows.length}
            className="rounded border border-hotel-blue px-3 py-1 text-sm disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>
      {payments.isLoading && <p className="text-sm">Loading payments…</p>}
      {payments.error && <p className="text-sm text-hotel-accent-red">{payments.error.message}</p>}
      <div className="overflow-auto rounded-2xl border border-hotel-gold-light bg-white">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-hotel-cream text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.data?.payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.guestName}</div>
                  <div className="text-[11px] text-slate-500">{p.guestEmail}</div>
                </td>
                <td className="px-4 py-3">
                  {p.roomNumber}
                  <span className="block text-[11px] text-slate-500">{p.roomType}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.checkInDate} → {p.checkOutDate}
                </td>
                <td className="px-4 py-3">
                  ${p.totalAmount.toFixed(2)}
                  <span className="block text-[11px] text-slate-500">
                    room ${p.roomCharges.toFixed(2)} · svc ${p.serviceCharges.toFixed(2)} · tax ${p.tax.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">{p.paymentMethod}</td>
                <td className="px-4 py-3">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.data && payments.data.payments.length === 0 && <p className="p-6 text-sm text-slate-500">No payments match those filters.</p>}
      </div>
    </div>
  );
}
