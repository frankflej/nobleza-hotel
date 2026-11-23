"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    if (authError) {
      setPending(false);
      setError(authError.message || "Could not create the account.");
      return;
    }
    const signedIn = await authClient.signIn.email({ email, password });
    setPending(false);
    if (signedIn.error) {
      router.push("/login");
      return;
    }
    router.push("/guest");
    router.refresh();
  }

  return (
    <AuthShell title="Create an account">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Full name
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        <label className="block text-sm">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-hotel-gold-light px-3 py-2" />
        </label>
        {error && <p className="text-sm text-hotel-accent-red">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded bg-hotel-blue py-2 text-hotel-cream disabled:opacity-60">
          {pending ? "Creating account…" : "Register"}
        </button>
      </form>
      <p className="mt-4 text-sm text-hotel-blue/70">
        Already have an account?{" "}
        <Link href="/login" className="text-hotel-gold-dark hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
