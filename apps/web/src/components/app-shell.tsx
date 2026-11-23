"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { dashboardPath, type HotelRole } from "@/lib/roles";

export function AppShell({
  title,
  allow,
  wide,
  nav,
  children,
}: {
  title: string;
  allow?: HotelRole[];
  wide?: boolean;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (isPending) {
    return <div className="p-8 text-hotel-blue">Loading session…</div>;
  }
  if (!user) {
    router.push("/login");
    return null;
  }
  if (allow && !allow.includes(user.role as HotelRole)) {
    router.replace(dashboardPath(user.role));
    return <div className="p-8 text-hotel-blue">Redirecting to your dashboard…</div>;
  }

  return (
    <div className="min-h-screen bg-hotel-cream text-hotel-blue">
      <header className="flex items-center justify-between bg-hotel-blue px-6 py-4 text-hotel-cream">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-serif text-xl text-hotel-gold">
            Nobleza Hotel
          </Link>
          <Link href={dashboardPath(user.role)} className="text-sm hover:text-hotel-gold">
            Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {user.name} <span className="text-hotel-cream/60">({user.role})</span>
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded border border-hotel-gold px-3 py-1 text-hotel-gold hover:bg-hotel-gold hover:text-hotel-blue-dark"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className={`mx-auto px-6 py-8 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        <h1 className="font-serif text-3xl">{title}</h1>
        {nav ? <div className="mt-4">{nav}</div> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
