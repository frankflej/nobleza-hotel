"use client";

import { AppShell } from "@/components/app-shell";
import { AdminTabs } from "@/components/admin-tabs";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Administration" allow={["admin"]} wide nav={<AdminTabs />}>
      {children}
    </AppShell>
  );
}
