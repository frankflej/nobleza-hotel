import Image from "next/image";
import Link from "next/link";
import hero from "@/assets/hero.png";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-hotel-cream">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-hotel-gold font-serif text-xl font-bold text-hotel-blue-dark shadow-gold">
            N
          </div>
          <div>
            <p className="font-serif text-lg tracking-wider text-hotel-gold">NOBLEZA HOTEL</p>
            <p className="text-[10px] uppercase tracking-widest text-white/70">Hospitality</p>
          </div>
        </div>
        <Link
          href="/login"
          className="rounded-full border border-hotel-gold/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-hotel-gold backdrop-blur hover:bg-white/20"
        >
          Member sign in
        </Link>
      </header>

      <section className="relative flex h-[560px] items-center justify-center overflow-hidden bg-hotel-blue-dark text-white">
        <Image
          src={hero}
          alt="PLACEHOLDER hero image — replace with a photograph of Nobleza Hotel"
          fill
          priority
          className="object-cover opacity-50"
        />
        <div className="relative z-10 max-w-3xl px-6 text-center">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-hotel-gold">Welcome</p>
          <h1 className="font-serif text-5xl font-medium tracking-wide text-white md:text-6xl">
            Nobleza Hotel
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/80">
            Reservations, guest services, and hotel operations in one place.
          </p>
          <p className="mx-auto mt-6 max-w-xl rounded-lg border border-hotel-gold/30 bg-black/30 px-4 py-3 text-xs leading-relaxed text-hotel-gold-light">
            PLACEHOLDER location copy: add the hotel address, city, and a short
            welcome here. Contact details and maps are listed in PLACEHOLDERS.md
            for you to supply.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl">A quieter stay, well looked after</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Guests can search and book rooms. The team uses dedicated boards for
          reception, housekeeping, demand forecasts, and administration.
        </p>
        <p className="mt-6 text-xs uppercase tracking-widest text-hotel-gold-dark">
          Room search and booking will be on this page in the next release.
        </p>
      </section>

      <footer className="border-t border-hotel-gold/20 px-6 py-8 text-center text-xs text-slate-500">
        <p>Nobleza Hotel</p>
        <p className="mt-1">PLACEHOLDER: phone, email, and street address to be supplied.</p>
      </footer>
    </div>
  );
}
