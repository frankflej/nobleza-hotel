"use client";

import { AppShell } from "@/components/app-shell";
import { ReceptionTabs } from "@/components/reception-tabs";

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="Front desk"
      allow={["receptionist", "manager", "admin"]}
      wide
      nav={<ReceptionTabs />}
    >
      {children}
    </AppShell>
  );
}
