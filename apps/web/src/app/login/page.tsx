import Link from "next/link";

export const metadata = { title: "Sign in" };

export default function LoginPlaceholderPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hotel-cream px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-hotel-gold font-serif text-xl font-bold text-hotel-blue-dark">
          N
        </div>
        <h1 className="font-serif text-2xl text-hotel-blue-dark">Nobleza Hotel</h1>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-hotel-gold/20 bg-white p-8 shadow-luxury">
        <h2 className="text-xl">Sign in</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Member sign-in is being connected in the next release. The database
          already has demo staff and guest accounts ready.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-hotel-blue px-5 py-2 text-xs font-semibold uppercase tracking-widest text-hotel-gold hover:bg-hotel-blue-hover"
        >
          Back to the hotel
        </Link>
      </div>
    </div>
  );
}
