"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { dashboardPath, safeInternalPath } from "@/lib/roles";
import { AuthShell } from "@/components/auth-shell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { data, error: authError } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (authError) {
      setError(authError.message || "Could not sign in.");
      return;
    }
    const user = data?.user as { role?: string; forcePasswordChange?: boolean } | undefined;
    if (user?.forcePasswordChange) {
      router.push("/change-password");
      return;
    }
    const next = params.get("next");
    router.push(safeInternalPath(next, dashboardPath(user?.role)));
    router.refresh();
  }

  return (
    <AuthShell title="Sign in">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        {error && <p className="text-sm text-hotel-accent-red">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded bg-hotel-blue py-2 text-hotel-cream disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-hotel-gold-dark hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-hotel-blue/70">
        New guest?{" "}
        <Link href="/register" className="text-hotel-gold-dark hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in"><p>Loading…</p></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
