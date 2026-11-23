"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useSession } from "@/lib/auth-client";
import { dashboardPath } from "@/lib/roles";
import { AuthShell } from "@/components/auth-shell";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const change = useMutation(trpc.user.changePassword.mutationOptions());
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      router.push(dashboardPath(session?.user?.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    }
  }

  return (
    <AuthShell title="Change your password">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Current password
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        <label className="block text-sm">
          New password
          <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        {error && <p className="text-sm text-hotel-accent-red">{error}</p>}
        <button type="submit" disabled={change.isPending} className="w-full rounded bg-hotel-blue py-2 text-hotel-cream disabled:opacity-60">
          {change.isPending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
