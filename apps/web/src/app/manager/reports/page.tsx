"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

type ReportType = "occupancy" | "revenue" | "audit";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ManagerReportsPage() {
  const queryClient = useQueryClient();
  const reports = useQuery(trpc.reports.list.queryOptions());
  const generate = useMutation(trpc.reports.generate.mutationOptions());
  const [type, setType] = useState<ReportType>("occupancy");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await generate.mutateAsync({
        type,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setNotice(`${type} report #${result.id} generated.`);
      setOpenId(result.id);
      await queryClient.invalidateQueries({ queryKey: trpc.reports.list.queryKey() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the report.");
    }
  }

  const open = reports.data?.find((r) => r.id === openId) ?? reports.data?.[0];

  return (
    <div className="space-y-4">
      {notice && <p className="rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <form onSubmit={onGenerate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-hotel-gold-light bg-white p-5">
        <label className="text-sm">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className="mt-1 block rounded border border-hotel-gold-light px-2 py-1.5">
            <option value="occupancy">Occupancy</option>
            <option value="revenue">Revenue</option>
            <option value="audit">Audit</option>
          </select>
        </label>
        <label className="text-sm">
          Start
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block rounded border border-hotel-gold-light px-2 py-1.5" />
        </label>
        <label className="text-sm">
          End
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block rounded border border-hotel-gold-light px-2 py-1.5" />
        </label>
        <button type="submit" disabled={generate.isPending} className="rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream">
          {generate.isPending ? "Generating…" : "Generate report"}
        </button>
        <p className="text-[11px] text-slate-500">Leave dates blank to use the current month to today. Forecast reports are not available.</p>
      </form>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-hotel-gold-light bg-white p-5 lg:col-span-4">
          <h2 className="font-serif text-lg">Saved reports</h2>
          {reports.isLoading && <p className="mt-3 text-sm">Loading…</p>}
          <ul className="mt-3 space-y-2">
            {reports.data?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    open?.id === r.id ? "border-hotel-gold bg-hotel-gold/10" : "border-slate-100 hover:bg-hotel-cream"
                  }`}
                >
                  <span className="font-medium capitalize">{r.type}</span>
                  <span className="block text-[11px] text-slate-500">
                    #{r.id} · {r.generatedBy} · {new Date(r.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
            {reports.data && reports.data.length === 0 && <li className="text-sm text-slate-500">No reports yet.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-hotel-gold-light bg-white p-5 lg:col-span-8">
          {!open && <p className="text-sm text-slate-500">Generate or select a report to view it.</p>}
          {open && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg capitalize">{open.type} report #{open.id}</h2>
                  <p className="text-xs text-slate-500">
                    Generated by {open.generatedBy} ({open.generatorRole})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadJson(open.data, `nobleza-${open.type}-report-${open.id}.json`)}
                  className="rounded border border-hotel-blue px-3 py-1 text-sm"
                >
                  Download JSON
                </button>
              </div>
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-lg bg-hotel-cream p-4 text-xs">
                {JSON.stringify(open.data, null, 2)}
              </pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
