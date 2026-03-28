import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateDestination } from "@/hooks/use-create-destination";
import { useSettingsBootstrap } from "@/hooks/use-settings-bootstrap";
import { useUpdateNotificationPreferences } from "@/hooks/use-update-notification-preferences";
import { requireAuth } from "@/lib/require-auth";

const destinationFieldIds = {
  absolutePath: "destination-absolute-path",
  komgaLibraryId: "destination-komga-library-id",
  name: "destination-name",
} as const;

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  const settingsQuery = useSettingsBootstrap();
  const createDestination = useCreateDestination();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const [name, setName] = useState("");
  const [absolutePath, setAbsolutePath] = useState("");
  const [komgaLibraryId, setKomgaLibraryId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setInAppEnabled(settingsQuery.data.notifications.inAppEnabled);
  }, [settingsQuery.data]);

  return (
    <AppShell
      subtitle="Settings now drive the actual download pipeline, starting with Komga-ready output folders that the worker can write to directly."
      title="System settings"
    >
      {settingsQuery.isLoading ? <Loader /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panelSurface p-6">
          <div className="eyebrow">Profile</div>
          <div className="mt-4 rounded-[24px] border border-border/60 bg-background/70 p-5">
            <div className="font-display text-2xl text-primary">
              {settingsQuery.data?.profile.name ?? "Reader profile"}
            </div>
            <div className="mt-2 text-muted-foreground text-sm">
              {settingsQuery.data?.profile.email ?? "No email loaded"}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-border/60 bg-background/70 p-5">
            <div className="font-medium text-lg">Notification delivery</div>
            <div className="mt-2 text-muted-foreground text-sm">
              Control whether in-app alerts stay live while background jobs and
              tracked updates arrive.
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm">
              <input
                checked={inAppEnabled}
                className="size-4 rounded border border-border"
                onChange={(event) => setInAppEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>Enable in-app live notifications</span>
            </label>

            <div className="mt-3 text-muted-foreground text-sm">
              Unread right now:{" "}
              {settingsQuery.data?.notifications.unreadCount ?? 0}
            </div>

            <Button
              className="mt-4"
              disabled={
                updateNotificationPreferences.isPending ||
                inAppEnabled ===
                  (settingsQuery.data?.notifications.inAppEnabled ?? true)
              }
              onClick={() => {
                updateNotificationPreferences.mutate({ inAppEnabled });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {updateNotificationPreferences.isPending
                ? "Saving..."
                : "Save notification settings"}
            </Button>
          </div>
        </section>

        <section className="panelSurface p-6">
          <div className="eyebrow">Destinations</div>
          <div className="mt-4 grid gap-4">
            <form
              className="grid gap-4 rounded-[24px] border border-border/60 bg-background/70 p-5"
              onSubmit={(event) => {
                event.preventDefault();

                createDestination
                  .mutateAsync({
                    absolutePath,
                    isDefault,
                    komgaLibraryId,
                    name,
                  })
                  .then(() => {
                    setAbsolutePath("");
                    setIsDefault(false);
                    setKomgaLibraryId("");
                    setName("");
                  })
                  .catch(() => undefined);
              }}
            >
              <div className="font-medium text-lg">Add a download folder</div>

              <label
                className="grid gap-2 text-sm"
                htmlFor={destinationFieldIds.name}
              >
                <span className="font-medium">Label</span>
                <Input
                  id={destinationFieldIds.name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Komga library"
                  value={name}
                />
              </label>

              <label
                className="grid gap-2 text-sm"
                htmlFor={destinationFieldIds.absolutePath}
              >
                <span className="font-medium">Absolute path</span>
                <Input
                  id={destinationFieldIds.absolutePath}
                  onChange={(event) => setAbsolutePath(event.target.value)}
                  placeholder="/srv/media/manga"
                  value={absolutePath}
                />
              </label>

              <label
                className="grid gap-2 text-sm"
                htmlFor={destinationFieldIds.komgaLibraryId}
              >
                <span className="font-medium">Komga library id</span>
                <Input
                  id={destinationFieldIds.komgaLibraryId}
                  onChange={(event) => setKomgaLibraryId(event.target.value)}
                  placeholder="Optional"
                  value={komgaLibraryId}
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  checked={isDefault}
                  className="size-4 rounded border border-border"
                  onChange={(event) => setIsDefault(event.target.checked)}
                  type="checkbox"
                />
                <span>Use as the default queue destination</span>
              </label>

              <Button
                disabled={
                  createDestination.isPending ||
                  name.trim().length === 0 ||
                  absolutePath.trim().length === 0
                }
                size="lg"
                type="submit"
              >
                {createDestination.isPending ? "Saving..." : "Save destination"}
              </Button>
            </form>

            <div className="grid gap-3">
              {settingsQuery.data?.destinations.map((destination) => (
                <div
                  className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                  key={destination.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{destination.name}</div>
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em]">
                      {destination.isDefault ? (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">
                          Default
                        </span>
                      ) : null}
                      <span className="rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">
                        {destination.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 break-all text-muted-foreground text-sm">
                    {destination.absolutePath}
                  </div>
                  {destination.komgaLibraryId ? (
                    <div className="mt-2 text-muted-foreground text-xs uppercase tracking-[0.16em]">
                      Komga library: {destination.komgaLibraryId}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
