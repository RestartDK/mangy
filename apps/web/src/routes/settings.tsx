import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { useSettingsBootstrap } from "@/hooks/useSettingsBootstrap";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  const settingsQuery = useSettingsBootstrap();

  return (
    <AppShell
      subtitle="Settings are now focused on manga delivery foundations rather than the old calendar profile and theme scaffolding."
      title="System settings"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <PlaceholderPanel
          description="Account identity still comes from Better Auth, but the settings surface has been cleared for Komga, destinations, and notification controls."
          eyebrow="Profile"
          title={settingsQuery.data?.profile.name ?? "Reader profile"}
        >
          <div className="text-muted-foreground text-sm">
            {settingsQuery.data?.profile.email ?? "No email loaded"}
          </div>
        </PlaceholderPanel>

        <PlaceholderPanel
          description="Destination management will grow here in the next slices. The backend already exposes the structure for Komga-ready output folders."
          eyebrow="Destinations"
          title={`Configured folders: ${settingsQuery.data?.destinations.length ?? 0}`}
        >
          <div className="grid gap-3">
            {settingsQuery.data?.destinations.map((destination) => (
              <div
                className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                key={destination.id}
              >
                <div className="font-medium">{destination.name}</div>
                <div className="mt-1 break-all text-muted-foreground text-sm">
                  {destination.absolutePath}
                </div>
              </div>
            ))}
          </div>
        </PlaceholderPanel>
      </div>
    </AppShell>
  );
}
