import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/nav";
import { requireAuth } from "@/lib/require-auth";

const SettingsLayoutComponent = () => (
  <AppShell>
    <PageHeader
      description="Manage your profile, appearance, notifications, and download destinations."
      title="Settings"
    />
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <SettingsNav />
      <div className="max-w-2xl min-w-0">
        <Outlet />
      </div>
    </div>
  </AppShell>
);

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  component: SettingsLayoutComponent,
});
