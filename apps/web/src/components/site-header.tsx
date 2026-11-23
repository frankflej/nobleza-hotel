"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { dashboardPath } from "@/lib/roles";

export function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-hotel-gold-light bg-hotel-blue px-6 py-4 text-hotel-cream">
      <Link href="/" className="font-serif text-xl tracking-wide text-hotel-gold">
        Nobleza Hotel
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {variant === "marketing" && (
          <>
            <a href="#rooms" className="hover:text-hotel-gold">
              Rooms
            </a>
            <a href="#about" className="hover:text-hotel-gold">
              About
            </a>
            <a href="#contact" className="hover:text-hotel-gold">
              Contact
            </a>
          </>
        )}
        {user ? (
          <>
            <Link href={dashboardPath(user.role)} className="hover:text-hotel-gold">
              Dashboard
            </Link>
            <span className="hidden text-hotel-cream/70 sm:inline">{user.name}</span>
            <button type="button" onClick={handleSignOut} className="rounded border border-hotel-gold px-3 py-1 text-hotel-gold hover:bg-hotel-gold hover:text-hotel-blue-dark">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-hotel-gold">
              Sign in
            </Link>
            <Link href="/register" className="rounded border border-hotel-gold px-3 py-1 text-hotel-gold hover:bg-hotel-gold hover:text-hotel-blue-dark">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
