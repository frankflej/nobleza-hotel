"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/reception/rooms", label: "Rooms" },
  { href: "/reception/front-desk", label: "Front desk" },
  { href: "/reception/crm", label: "CRM" },
  { href: "/reception/calendar", label: "Calendar" },
] as const;

export function ReceptionTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-hotel-gold-light pb-3">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-1.5 text-sm ${
              active
                ? "bg-hotel-blue text-hotel-cream"
                : "bg-white text-hotel-blue hover:bg-hotel-gold/20"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
