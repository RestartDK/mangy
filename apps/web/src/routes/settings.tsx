import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useBrowserPushClientState,
  useConnectCurrentBrowserPush,
  useDisconnectCurrentBrowserPush,
} from "@/hooks/use-browser-push";
import { useCreateDestination } from "@/hooks/use-create-destination";
import { useDeleteDestination } from "@/hooks/use-delete-destination";
import { usePushSettings } from "@/hooks/use-push-settings";
import { useSendBrowserPushTest } from "@/hooks/use-send-browser-push-test";
import {
  type SettingsBootstrap,
  useSettingsBootstrap,
} from "@/hooks/use-settings-bootstrap";
import { useUpdateBrowserPushPreferences } from "@/hooks/use-update-browser-push-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/use-update-notification-preferences";
import { formatDateTime, getErrorMessage } from "@/lib/format";
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
  const pushSettingsQuery = usePushSettings();
  const browserPushClientStateQuery = useBrowserPushClientState();
  const createDestination = useCreateDestination();
  const deleteDestination = useDeleteDestination();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const { setTheme, theme } = useTheme();
  const updateBrowserPushPreferences = useUpdateBrowserPushPreferences();
  const connectCurrentBrowserPush = useConnectCurrentBrowserPush();
  const disconnectCurrentBrowserPush = useDisconnectCurrentBrowserPush();
  const sendBrowserPushTest = useSendBrowserPushTest();
  const [name, setName] = useState("");
  const [absolutePath, setAbsolutePath] = useState("");
  const [komgaLibraryId, setKomgaLibraryId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [destinationPendingRemoval, setDestinationPendingRemoval] = useState<
    SettingsBootstrap["destinations"][number] | null
  >(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);
  const [notifyOnDownloadCompleted, setNotifyOnDownloadCompleted] =
    useState(true);
  const [notifyOnDownloadFailed, setNotifyOnDownloadFailed] = useState(true);
  const [notifyOnTrackedSeriesUpdate, setNotifyOnTrackedSeriesUpdate] =
    useState(true);
  const [notifyOnSystemWarning, setNotifyOnSystemWarning] = useState(true);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setInAppEnabled(settingsQuery.data.notifications.inAppEnabled);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!pushSettingsQuery.data) {
      return;
    }

    setNotifyOnDownloadCompleted(
      pushSettingsQuery.data.notifyOnDownloadCompleted
    );
    setNotifyOnDownloadFailed(pushSettingsQuery.data.notifyOnDownloadFailed);
    setNotifyOnTrackedSeriesUpdate(
      pushSettingsQuery.data.notifyOnTrackedSeriesUpdate
    );
    setNotifyOnSystemWarning(pushSettingsQuery.data.notifyOnSystemWarning);
  }, [pushSettingsQuery.data]);

  const hasBrowserPushPreferenceChanges = useMemo(() => {
    if (!pushSettingsQuery.data) {
      return false;
    }

    return (
      notifyOnDownloadCompleted !==
        pushSettingsQuery.data.notifyOnDownloadCompleted ||
      notifyOnDownloadFailed !==
        pushSettingsQuery.data.notifyOnDownloadFailed ||
      notifyOnTrackedSeriesUpdate !==
        pushSettingsQuery.data.notifyOnTrackedSeriesUpdate ||
      notifyOnSystemWarning !== pushSettingsQuery.data.notifyOnSystemWarning
    );
  }, [
    notifyOnDownloadCompleted,
    notifyOnDownloadFailed,
    notifyOnTrackedSeriesUpdate,
    notifyOnSystemWarning,
    pushSettingsQuery.data,
  ]);

  const isLoading =
    settingsQuery.isLoading ||
    pushSettingsQuery.isLoading ||
    browserPushClientStateQuery.isLoading;

  const pageError =
    settingsQuery.error ||
    pushSettingsQuery.error ||
    browserPushClientStateQuery.error;

  const isCurrentBrowserPushEnabled = Boolean(
    pushSettingsQuery.data?.isEnabled &&
      browserPushClientStateQuery.data?.isSubscribed &&
      browserPushClientStateQuery.data?.permission === "granted"
  );

  const browserPushPermissionLabel =
    browserPushClientStateQuery.data?.permission === "secureContextRequired"
      ? "requires HTTPS or localhost"
      : (browserPushClientStateQuery.data?.permission ?? "unknown");

  const isBrowserPushTogglePending =
    connectCurrentBrowserPush.isPending ||
    disconnectCurrentBrowserPush.isPending;

  const handleBrowserPushToggle = async (checked: boolean) => {
    const pushSettings = pushSettingsQuery.data;
    const browserPushClientState = browserPushClientStateQuery.data;

    if (!(pushSettings && browserPushClientState)) {
      return;
    }

    if (checked) {
      if (!pushSettings.vapidPublicKey) {
        return;
      }

      await connectCurrentBrowserPush
        .mutateAsync({ vapidPublicKey: pushSettings.vapidPublicKey })
        .catch(() => undefined);

      return;
    }

    await disconnectCurrentBrowserPush.mutateAsync().catch(() => undefined);
  };

  return (
    <AppShell>
      <PageHeader
        description="Update your profile details, choose how notifications work, and manage download destinations."
        title="Settings"
      />

      {pageError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load settings</AlertTitle>
          <AlertDescription>
            {getErrorMessage(pageError, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <SettingsSkeleton /> : null}

      {isLoading ? null : (
        <div className="page-grid lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Your account details for this workspace.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <ProfileField
                  label="Name"
                  value={settingsQuery.data?.profile.name ?? "Not available"}
                />
                <ProfileField
                  label="Email"
                  value={settingsQuery.data?.profile.email ?? "Not available"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Choose whether Mangy follows your system theme or forces a
                  light or dark surface.
                </p>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="theme-preference">Theme</FieldLabel>
                    <Select
                      onValueChange={setTheme}
                      value={hasMounted ? (theme ?? "system") : "system"}
                    >
                      <SelectTrigger className="w-full" id="theme-preference">
                        <SelectValue placeholder="Choose a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      System matches your OS preference automatically.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Decide whether in-app notifications stay active.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">In-app notifications</div>
                    <p className="text-muted-foreground text-sm">
                      Show updates for completed downloads, failures, and
                      tracked-series changes.
                    </p>
                  </div>
                  <Switch
                    checked={inAppEnabled}
                    onCheckedChange={setInAppEnabled}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {settingsQuery.data?.notifications.unreadCount ?? 0} unread
                    notifications
                  </span>
                  <Button
                    disabled={
                      updateNotificationPreferences.isPending ||
                      inAppEnabled ===
                        (settingsQuery.data?.notifications.inAppEnabled ?? true)
                    }
                    onClick={() => {
                      updateNotificationPreferences.mutate({ inAppEnabled });
                    }}
                    type="button"
                    variant="outline"
                  >
                    {updateNotificationPreferences.isPending
                      ? "Saving..."
                      : "Save notification settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser notifications</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Turning this on should immediately ask the browser whether
                  this site can show notifications.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">
                      Allow notifications on this browser
                    </div>
                    <p className="text-muted-foreground text-sm">
                      This requests browser permission right away and registers
                      this browser for push delivery.
                    </p>
                  </div>
                  <Switch
                    checked={isCurrentBrowserPushEnabled}
                    disabled={
                      isBrowserPushTogglePending ||
                      !pushSettingsQuery.data?.isConfigured ||
                      !browserPushClientStateQuery.data?.isSupported ||
                      !browserPushClientStateQuery.data?.isSecureContext
                    }
                    onCheckedChange={(checked) => {
                      void handleBrowserPushToggle(checked);
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    tone={
                      browserPushClientStateQuery.data?.isSupported
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {browserPushClientStateQuery.data?.isSupported
                      ? "Supported"
                      : "Not supported"}
                  </StatusBadge>
                  <StatusBadge
                    tone={
                      browserPushClientStateQuery.data?.permission === "granted"
                        ? "secondary"
                        : browserPushClientStateQuery.data?.permission ===
                            "denied"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    Permission: {browserPushPermissionLabel}
                  </StatusBadge>
                  <StatusBadge
                    tone={isCurrentBrowserPushEnabled ? "secondary" : "outline"}
                  >
                    {isCurrentBrowserPushEnabled
                      ? "Enabled on this browser"
                      : "Disabled on this browser"}
                  </StatusBadge>
                </div>

                {pushSettingsQuery.data?.isConfigured ? null : (
                  <Alert>
                    <AlertTitle>Browser push is not configured yet</AlertTitle>
                    <AlertDescription>
                      Add VAPID keys on the server before enabling browser
                      notifications.
                    </AlertDescription>
                  </Alert>
                )}

                {browserPushClientStateQuery.data?.permission === "denied" ? (
                  <Alert variant="destructive">
                    <AlertTitle>Browser permission is blocked</AlertTitle>
                    <AlertDescription>
                      Re-enable notifications in your browser site settings,
                      then turn the browser notifications switch on again.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {browserPushClientStateQuery.data?.isSupported &&
                !browserPushClientStateQuery.data.isSecureContext ? (
                  <Alert variant="destructive">
                    <AlertTitle>
                      Browser notifications need HTTPS or localhost
                    </AlertTitle>
                    <AlertDescription>
                      Browsers do not show the native permission prompt on plain
                      HTTP IP addresses like `100.91.192.69`. Use
                      `http://localhost:3001` or serve the app over HTTPS.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="rounded-lg border p-4">
                  <div className="font-medium">Delivery status</div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Last delivery:{" "}
                      {formatDateTime(pushSettingsQuery.data?.lastDeliveredAt)}
                    </span>
                    <span className="text-muted-foreground">
                      Last error: {pushSettingsQuery.data?.lastError ?? "None"}
                    </span>
                  </div>
                </div>

                <FieldGroup>
                  <Field>
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                      <div className="space-y-1">
                        <FieldLabel>Download completed</FieldLabel>
                        <FieldDescription>
                          Notify when a chapter finishes downloading.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={notifyOnDownloadCompleted}
                        onCheckedChange={setNotifyOnDownloadCompleted}
                      />
                    </div>
                  </Field>

                  <Field>
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                      <div className="space-y-1">
                        <FieldLabel>Download failed</FieldLabel>
                        <FieldDescription>
                          Notify when retries are exhausted and action is
                          needed.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={notifyOnDownloadFailed}
                        onCheckedChange={setNotifyOnDownloadFailed}
                      />
                    </div>
                  </Field>

                  <Field>
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                      <div className="space-y-1">
                        <FieldLabel>Tracked series updates</FieldLabel>
                        <FieldDescription>
                          Notify when tracked series queue new chapters.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={notifyOnTrackedSeriesUpdate}
                        onCheckedChange={setNotifyOnTrackedSeriesUpdate}
                      />
                    </div>
                  </Field>

                  <Field>
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                      <div className="space-y-1">
                        <FieldLabel>System warnings</FieldLabel>
                        <FieldDescription>
                          Notify when tracking or import issues need attention.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={notifyOnSystemWarning}
                        onCheckedChange={setNotifyOnSystemWarning}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    disabled={
                      updateBrowserPushPreferences.isPending ||
                      !hasBrowserPushPreferenceChanges
                    }
                    onClick={() => {
                      updateBrowserPushPreferences.mutate({
                        isEnabled: pushSettingsQuery.data?.isEnabled ?? false,
                        notifyOnDownloadCompleted,
                        notifyOnDownloadFailed,
                        notifyOnTrackedSeriesUpdate,
                        notifyOnSystemWarning,
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    {updateBrowserPushPreferences.isPending
                      ? "Saving..."
                      : "Save browser notification settings"}
                  </Button>

                  <Button
                    disabled={
                      sendBrowserPushTest.isPending ||
                      !pushSettingsQuery.data?.isConfigured ||
                      !isCurrentBrowserPushEnabled
                    }
                    onClick={() => {
                      sendBrowserPushTest.mutate();
                    }}
                    type="button"
                  >
                    {sendBrowserPushTest.isPending
                      ? "Sending..."
                      : "Send test notification"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Destinations</CardTitle>
              <p className="text-muted-foreground text-sm">
                Add folders where queued chapters should be saved.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-4 rounded-lg border p-4"
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
                <div className="space-y-1">
                  <h2 className="font-medium">Add destination</h2>
                  <p className="text-muted-foreground text-sm">
                    Save chapters to a folder that your reader or media server
                    can access.
                  </p>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={destinationFieldIds.name}>
                      Name
                    </FieldLabel>
                    <Input
                      id={destinationFieldIds.name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Main library"
                      value={name}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={destinationFieldIds.absolutePath}>
                      Absolute path
                    </FieldLabel>
                    <Input
                      id={destinationFieldIds.absolutePath}
                      onChange={(event) => setAbsolutePath(event.target.value)}
                      placeholder="/srv/media/manga"
                      value={absolutePath}
                    />
                    <FieldDescription>
                      Use the full path where downloads should be written.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={destinationFieldIds.komgaLibraryId}>
                      Komga library ID
                    </FieldLabel>
                    <Input
                      id={destinationFieldIds.komgaLibraryId}
                      onChange={(event) =>
                        setKomgaLibraryId(event.target.value)
                      }
                      placeholder="Optional"
                      value={komgaLibraryId}
                    />
                    <FieldDescription>
                      Add this if you want to tie the destination to a specific
                      Komga library.
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">Default destination</div>
                    <p className="text-muted-foreground text-sm">
                      Use this folder automatically when a series does not have
                      a destination saved yet.
                    </p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>

                <Button
                  className="w-full"
                  disabled={
                    createDestination.isPending ||
                    name.trim().length === 0 ||
                    absolutePath.trim().length === 0
                  }
                  size="lg"
                  type="submit"
                >
                  {createDestination.isPending
                    ? "Saving..."
                    : "Save destination"}
                </Button>
              </form>

              {settingsQuery.data?.destinations.length ? (
                <div className="grid gap-3">
                  {settingsQuery.data.destinations.map((destination) => (
                    <Card key={destination.id} size="sm">
                      <CardContent className="space-y-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {destination.name}
                            </div>
                            <div className="break-all text-muted-foreground text-sm">
                              {destination.absolutePath}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {destination.isDefault ? (
                              <StatusBadge tone="secondary">
                                Default
                              </StatusBadge>
                            ) : null}
                            <StatusBadge
                              tone={
                                destination.isEnabled ? "secondary" : "outline"
                              }
                            >
                              {destination.isEnabled ? "Enabled" : "Disabled"}
                            </StatusBadge>
                          </div>
                        </div>
                        {destination.komgaLibraryId ? (
                          <div className="text-muted-foreground text-sm">
                            Komga library ID: {destination.komgaLibraryId}
                          </div>
                        ) : null}
                        <div className="flex justify-end">
                          <Button
                            disabled={deleteDestination.isPending}
                            onClick={() => {
                              setDestinationPendingRemoval(destination);
                            }}
                            type="button"
                            variant="destructive"
                          >
                            <Trash2 className="size-4" />
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Add your first destination so queued chapters know where to go."
                  title="No destinations yet"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDestinationPendingRemoval(null);
          }
        }}
        open={destinationPendingRemoval !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove destination</DialogTitle>
            <DialogDescription>
              {destinationPendingRemoval
                ? `Remove ${destinationPendingRemoval.name}? Any tracked series using this destination will keep tracking, but auto-download will be turned off.`
                : "Remove this destination?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                const destinationId = destinationPendingRemoval?.id;
                if (!destinationId) {
                  return;
                }

                deleteDestination
                  .mutateAsync(destinationId)
                  .then(() => {
                    setDestinationPendingRemoval(null);
                  })
                  .catch(() => undefined);
              }}
              type="button"
              variant="destructive"
            >
              {deleteDestination.isPending ? "Removing..." : "Remove"}
            </Button>
            <Button
              disabled={deleteDestination.isPending}
              onClick={() => {
                setDestinationPendingRemoval(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const ProfileField = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
};

const SettingsSkeleton = () => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
    <Card>
      <CardContent className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  </div>
);
