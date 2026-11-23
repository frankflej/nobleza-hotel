"use client";

import { AppShell } from "@/components/app-shell";
import { ManagerTabs } from "@/components/manager-tabs";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Manager" allow={["manager", "admin"]} wide nav={<ManagerTabs />}>
      {children}
    </AppShell>
  );
}
