"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: authError } = await authClient.requestPasswordReset({ email, redirectTo });
    setPending(false);
    if (authError) {
      setError(authError.message || "Could not start a password reset.");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell title="Reset your password">
      {done ? (
        <p className="text-sm">
          If that email is registered, a reset link has been sent. In local development without SMTP, the link is printed in the server logs.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
          </label>
          {error && <p className="text-sm text-hotel-accent-red">{error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded bg-hotel-blue py-2 text-hotel-cream disabled:opacity-60">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-hotel-gold-dark hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
