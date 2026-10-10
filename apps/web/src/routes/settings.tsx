import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
      ? "requires HTTPS"
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

  const unreadCount = settingsQuery.data?.notifications.unreadCount ?? 0;
  const permission = browserPushClientStateQuery.data?.permission;
  let permissionTone: StatusTone = "neutral";
  if (permission === "granted") {
    permissionTone = "success";
  }
  if (permission === "denied") {
    permissionTone = "danger";
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />

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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex flex-col gap-6">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Account</h2>
              </div>
              <dl className="rows">
                <div className="row">
                  <dt className="meta">Name</dt>
                  <dd className="text-sm">
                    {settingsQuery.data?.profile.name ?? "Not set"}
                  </dd>
                </div>
                <div className="row">
                  <dt className="meta">Email</dt>
                  <dd className="text-sm">
                    {settingsQuery.data?.profile.email ?? "Not set"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Appearance</h2>
              </div>
              <div className="p-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="theme-preference">Theme</FieldLabel>
                    <Select
                      onValueChange={setTheme}
                      value={hasMounted ? (theme ?? "system") : "system"}
                    >
                      <SelectTrigger
                        className="h-8 w-full sm:w-52"
                        id="theme-preference"
                      >
                        <SelectValue placeholder="Choose a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription className="text-xs">
                      System follows your OS preference.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Notifications</h2>
                <span className="meta">
                  {unreadCount === 0 ? "No unread" : `${unreadCount} unread`}
                </span>
              </div>
              <div className="rows">
                <ToggleRow
                  checked={inAppEnabled}
                  description="Completed downloads, failures, tracked-series changes."
                  label="In-app notifications"
                  onCheckedChange={setInAppEnabled}
                />
              </div>
              <div className="border-border flex justify-end border-t px-4 py-3">
                <Button
                  disabled={
                    updateNotificationPreferences.isPending ||
                    inAppEnabled ===
                      (settingsQuery.data?.notifications.inAppEnabled ?? true)
                  }
                  onClick={() => {
                    updateNotificationPreferences.mutate({ inAppEnabled });
                  }}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {updateNotificationPreferences.isPending
                    ? "Saving..."
                    : "Save"}
                </Button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Browser notifications</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <StatusBadge
                    tone={
                      browserPushClientStateQuery.data?.isSupported
                        ? "success"
                        : "neutral"
                    }
                  >
                    {browserPushClientStateQuery.data?.isSupported
                      ? "Supported"
                      : "Not supported"}
                  </StatusBadge>
                  <StatusBadge tone={permissionTone}>
                    Permission: {browserPushPermissionLabel}
                  </StatusBadge>
                </div>
              </div>

              <div className="rows">
                <ToggleRow
                  checked={isCurrentBrowserPushEnabled}
                  description="Register this browser for push delivery."
                  disabled={
                    isBrowserPushTogglePending ||
                    !pushSettingsQuery.data?.isConfigured ||
                    !browserPushClientStateQuery.data?.isSupported ||
                    !browserPushClientStateQuery.data?.isSecureContext
                  }
                  label="Enable on this browser"
                  onCheckedChange={(checked) => {
                    handleBrowserPushToggle(checked).catch(() => undefined);
                  }}
                />
                <ToggleRow
                  checked={notifyOnDownloadCompleted}
                  description="A chapter finishes downloading."
                  label="Download completed"
                  onCheckedChange={setNotifyOnDownloadCompleted}
                />
                <ToggleRow
                  checked={notifyOnDownloadFailed}
                  description="Retries are exhausted and action is needed."
                  label="Download failed"
                  onCheckedChange={setNotifyOnDownloadFailed}
                />
                <ToggleRow
                  checked={notifyOnTrackedSeriesUpdate}
                  description="Tracked series queue new chapters."
                  label="Tracked series updates"
                  onCheckedChange={setNotifyOnTrackedSeriesUpdate}
                />
                <ToggleRow
                  checked={notifyOnSystemWarning}
                  description="Tracking or import issues need attention."
                  label="System warnings"
                  onCheckedChange={setNotifyOnSystemWarning}
                />
              </div>

              <div className="space-y-4 px-4 py-4">
                <dl className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="meta">Last delivery</dt>
                    <dd className="text-xs">
                      {formatDateTime(pushSettingsQuery.data?.lastDeliveredAt)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="meta">Last error</dt>
                    <dd className="text-xs">
                      {pushSettingsQuery.data?.lastError ?? "None"}
                    </dd>
                  </div>
                </dl>

                {pushSettingsQuery.data?.isConfigured ? null : (
                  <Alert>
                    <AlertTitle>Browser push is not configured</AlertTitle>
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
                      Re-enable notifications in your browser site settings.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {browserPushClientStateQuery.data?.isSupported &&
                !browserPushClientStateQuery.data.isSecureContext ? (
                  <Alert variant="destructive">
                    <AlertTitle>Needs HTTPS or localhost</AlertTitle>
                    <AlertDescription>
                      Browsers only allow notifications on HTTPS or localhost.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
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
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {updateBrowserPushPreferences.isPending
                    ? "Saving..."
                    : "Save"}
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
                  size="lg"
                  type="button"
                >
                  {sendBrowserPushTest.isPending
                    ? "Sending..."
                    : "Send test notification"}
                </Button>
              </div>
            </section>
          </div>

          <section className="panel h-fit">
            <div className="panel-header">
              <h2 className="panel-title">Destinations</h2>
              <span className="meta">
                {settingsQuery.data?.destinations.length ?? 0} saved
              </span>
            </div>

            {settingsQuery.data?.destinations.length ? (
              <div className="rows">
                {settingsQuery.data.destinations.map((destination) => (
                  <div className="row" key={destination.id}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="truncate text-sm font-medium">
                          {destination.name}
                        </h3>
                        {destination.isDefault ? (
                          <StatusBadge tone="brand">Default</StatusBadge>
                        ) : null}
                        {destination.isEnabled ? null : (
                          <StatusBadge tone="neutral">Disabled</StatusBadge>
                        )}
                      </div>
                      <p className="meta break-all">
                        {destination.absolutePath}
                      </p>
                      {destination.komgaLibraryId ? (
                        <p className="meta break-all">
                          Komga library {destination.komgaLibraryId}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      aria-label={`Remove ${destination.name}`}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                      disabled={deleteDestination.isPending}
                      onClick={() => {
                        setDestinationPendingRemoval(destination);
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                className="border-border rounded-none border-0 border-b"
                description="Add a folder so queued chapters know where to go."
                title="No destinations yet"
              />
            )}

            <form
              className="space-y-4 p-4"
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
              <h3 className="panel-title">Add destination</h3>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={destinationFieldIds.name}>
                    Name
                  </FieldLabel>
                  <Input
                    className="h-8"
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
                    className="h-8"
                    id={destinationFieldIds.absolutePath}
                    onChange={(event) => setAbsolutePath(event.target.value)}
                    placeholder="/srv/media/manga"
                    value={absolutePath}
                  />
                  <FieldDescription className="text-xs">
                    Folder where downloads are written.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor={destinationFieldIds.komgaLibraryId}>
                    Komga library ID
                  </FieldLabel>
                  <Input
                    className="h-8"
                    id={destinationFieldIds.komgaLibraryId}
                    onChange={(event) => setKomgaLibraryId(event.target.value)}
                    placeholder="Optional"
                    value={komgaLibraryId}
                  />
                  <FieldDescription className="text-xs">
                    Only needed to tie this folder to a Komga library.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <ToggleRow
                checked={isDefault}
                description="Use this folder when a series has no destination."
                label="Default destination"
                onCheckedChange={setIsDefault}
              />

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
                {createDestination.isPending ? "Saving..." : "Save destination"}
              </Button>
            </form>
          </section>
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
                ? `Remove ${destinationPendingRemoval.name}? Series using it keep tracking, but auto-download turns off.`
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

interface ToggleRowProps {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

const ToggleRow = ({
  checked,
  description,
  disabled,
  label,
  onCheckedChange,
}: ToggleRowProps) => (
  <div className="row">
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="meta">{description}</p>
    </div>
    <Switch
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  </div>
);

const SettingsSkeleton = () => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <div className="flex flex-col gap-6">
      <div className="panel space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="panel space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
    <div className="panel space-y-4 p-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);
