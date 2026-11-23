"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

const ROLES = ["guest", "receptionist", "housekeeping", "manager", "admin"] as const;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const users = useQuery(trpc.admin.users.queryOptions());
  const createUser = useMutation(trpc.admin.createUser.mutationOptions());
  const updateUser = useMutation(trpc.admin.updateUser.mutationOptions());
  const deleteUser = useMutation(trpc.admin.deleteUser.mutationOptions());

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("receptionist");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: trpc.admin.users.queryKey() });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = await createUser.mutateAsync({ name, email, role });
      setName("");
      setEmail("");
      if (created.tempPassword) {
        setNotice(`Account created for ${created.email}. Temporary password (shown once, SMTP is not configured): ${created.tempPassword}`);
      } else {
        setNotice(`Account created for ${created.email}. A temporary password was emailed.`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  async function changeRole(id: string, nextRole: (typeof ROLES)[number]) {
    setError(null);
    try {
      await updateUser.mutateAsync({ id, role: nextRole });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the role.");
    }
  }

  async function changeStatus(id: string, status: "active" | "inactive") {
    setError(null);
    try {
      await updateUser.mutateAsync({ id, status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the status.");
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteUser.mutateAsync({ id });
      setNotice(`Deleted ${label}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the user.");
    }
  }

  return (
    <div className="space-y-6">
      {notice && <p className="rounded border border-hotel-gold bg-hotel-gold/10 p-3 text-sm">{notice}</p>}
      {error && <p className="rounded border border-hotel-accent-red bg-red-50 p-3 text-sm text-hotel-accent-red">{error}</p>}

      <form onSubmit={onCreate} className="rounded-2xl border border-hotel-gold-light bg-white p-5">
        <h2 className="font-serif text-lg">Create account</h2>
        <p className="mt-1 text-sm text-slate-600">
          A temporary password is emailed when SMTP is configured. Otherwise it is shown once on this page so you can share it.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="rounded border border-slate-200 px-3 py-2 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={createUser.isPending} className="rounded bg-hotel-blue px-4 py-2 text-sm text-hotel-cream disabled:opacity-60">
            {createUser.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-2xl border border-hotel-gold-light bg-white">
        {users.isLoading && <p className="p-6 text-sm">Loading users…</p>}
        {users.error && <p className="p-6 text-sm text-hotel-accent-red">{users.error.message}</p>}
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-hotel-cream text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {u.name}
                  {u.forcePasswordChange && <span className="ml-2 text-[11px] text-hotel-gold-dark">must change password</span>}
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as (typeof ROLES)[number])} className="rounded border border-slate-200 px-2 py-1 text-xs">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => changeStatus(u.id, u.status === "active" ? "inactive" : "active")} className="text-xs underline">
                    {u.status}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => onDelete(u.id, u.email)} className="text-xs text-hotel-accent-red underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
