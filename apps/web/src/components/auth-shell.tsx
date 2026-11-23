import Link from "next/link";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-hotel-cream text-hotel-blue">
      <header className="bg-hotel-blue px-6 py-4">
        <Link href="/" className="font-serif text-xl text-hotel-gold">
          Nobleza Hotel
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="font-serif text-3xl">{title}</h1>
        <div className="mt-6 rounded-xl border border-hotel-gold-light bg-white p-6 shadow-sm">{children}</div>
      </main>
    </div>
  );
}
