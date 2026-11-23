"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }
    setPending(true);
    const { error: authError } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (authError) {
      setError(authError.message || "Could not reset the password.");
      return;
    }
    router.push("/login");
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          New password
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        {error && <p className="text-sm text-hotel-accent-red">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded bg-hotel-blue py-2 text-hotel-cream disabled:opacity-60">
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-hotel-gold-dark hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Choose a new password"><p>Loading…</p></AuthShell>}>
      <ResetForm />
    </Suspense>
  );
}
