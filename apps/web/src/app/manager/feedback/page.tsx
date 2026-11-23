"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function ManagerFeedbackPage() {
  const queryClient = useQueryClient();
  const list = useQuery(trpc.feedback.list.queryOptions());
  const respond = useMutation(trpc.feedback.respond.mutationOptions());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onRespond(e: FormEvent) {
    e.preventDefault();
    if (activeId == null) return;
    setError(null);
    try {
      await respond.mutateAsync({ id: activeId, staffResponse: reply });
      setNotice("Response saved.");
      setReply("");
      setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: trpc.feedback.list.queryKey() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the response.");
    }
  }

  return (
    <div className="space-y-4">
      {notice && <p className="rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}
      <h2 className="font-serif text-lg">Guest feedback</h2>
      {list.isLoading && <p className="text-sm">Loading feedback…</p>}
      {list.error && <p className="text-sm text-hotel-accent-red">{list.error.message}</p>}
      <ul className="space-y-3">
        {list.data?.map((f) => (
          <li key={f.id} className="rounded-2xl border border-hotel-gold-light bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {f.title} <span className="text-xs font-normal text-slate-500">· {f.rating}/5 · {f.category} · {f.status}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {f.user.name} ({f.user.email}) · {new Date(f.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-sm">{f.message}</p>
                {f.staffResponse && <p className="mt-2 text-sm text-hotel-blue">Staff: {f.staffResponse}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveId(f.id);
                  setReply(f.staffResponse ?? "");
                }}
                className="rounded border border-hotel-blue px-3 py-1 text-xs"
              >
                Respond
              </button>
            </div>
            {activeId === f.id && (
              <form onSubmit={onRespond} className="mt-3">
                <textarea
                  required
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-hotel-gold-light px-3 py-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button type="submit" disabled={respond.isPending} className="rounded bg-hotel-blue px-3 py-1.5 text-xs text-hotel-cream">
                    Save response
                  </button>
                  <button type="button" onClick={() => setActiveId(null)} className="text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
        {list.data && list.data.length === 0 && <li className="text-sm text-slate-500">No feedback yet.</li>}
      </ul>
    </div>
  );
}
