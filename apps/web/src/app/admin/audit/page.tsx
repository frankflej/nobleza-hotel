"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function AdminAuditPage() {
  const logs = useQuery(trpc.admin.auditLogs.queryOptions());
  return (
    <div className="overflow-auto rounded-2xl border border-hotel-gold-light bg-white">
      {logs.isLoading && <p className="p-6 text-sm">Loading audit log…</p>}
      {logs.error && <p className="p-6 text-sm text-hotel-accent-red">{logs.error.message}</p>}
      <table className="w-full text-left text-xs md:text-sm">
        <thead className="bg-hotel-cream text-[11px] uppercase text-slate-600">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Who</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.data?.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-4 py-2 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2">
                {l.userName}
                <span className="block text-[11px] text-slate-500">{l.userRole}</span>
              </td>
              <td className="px-4 py-2">{l.action}</td>
              <td className="px-4 py-2">{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
