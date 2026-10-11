import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { reactivityKey } from "@/atoms/keys";
import { updateNotificationPreferences } from "@/atoms/notifications";
import {
  browserPushClientState,
  browserPushSettingsQuery,
  createDestination,
  deleteDestination,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  settingsBootstrapQuery,
  updateBrowserPushPreferences,
} from "@/atoms/settings";
import type { SettingsBootstrap } from "@/atoms/settings";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/components/status-badge";
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
  asyncResultError,
  asyncResultLoading,
  asyncResultValue,
} from "@/lib/async-result";
import {
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
} from "@/lib/browser-push";
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";
import { requireAuth } from "@/lib/require-auth";

const destinationFieldIds = {
  absolutePath: "destination-absolute-path",
  komgaLibraryId: "destination-komga-library-id",
  name: "destination-name",
} as const;

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
const SettingsRouteComponent = () => {
  const settingsResult = useAtomValue(settingsBootstrapQuery);
  const pushSettingsResult = useAtomValue(browserPushSettingsQuery);
  const clientStateResult = useAtomValue(browserPushClientState);
  const createDestinationRequest = useAtomSet(createDestination, {
    mode: "promise",
  });
  const deleteDestinationRequest = useAtomSet(deleteDestination, {
    mode: "promise",
  });
  const saveNotificationPreferences = useAtomSet(
    updateNotificationPreferences,
    {
      mode: "promise",
    }
  );
  const { setTheme, theme } = useTheme();
  const saveBrowserPushPreferences = useAtomSet(updateBrowserPushPreferences, {
    mode: "promise",
  });
  const connectCurrentBrowserPush = useAtomSet(savePushSubscription, {
    mode: "promise",
  });
  const disconnectCurrentBrowserPush = useAtomSet(removePushSubscription, {
    mode: "promise",
  });
  const sendBrowserPushTestRequest = useAtomSet(sendTestPush, {
    mode: "promise",
  });
  const createDestinationResult = useAtomValue(createDestination);
  const deleteDestinationResult = useAtomValue(deleteDestination);
  const notificationPreferencesResult = useAtomValue(
    updateNotificationPreferences
  );
  const browserPushPreferencesResult = useAtomValue(
    updateBrowserPushPreferences
  );
  const connectPushResult = useAtomValue(savePushSubscription);
  const disconnectPushResult = useAtomValue(removePushSubscription);
  const sendPushTestResult = useAtomValue(sendTestPush);
  const isSavingDestination = AsyncResult.isWaiting(createDestinationResult);
  const isRemovingDestination = AsyncResult.isWaiting(deleteDestinationResult);
  const isSavingNotificationPreferences = AsyncResult.isWaiting(
    notificationPreferencesResult
  );
  const isSavingBrowserPushPreferences = AsyncResult.isWaiting(
    browserPushPreferencesResult
  );
  const isConnectingPush = AsyncResult.isWaiting(connectPushResult);
  const isDisconnectingPush = AsyncResult.isWaiting(disconnectPushResult);
  const isSendingPushTest = AsyncResult.isWaiting(sendPushTestResult);
  const [name, setName] = useState("");
  const [absolutePath, setAbsolutePath] = useState("");
  const [komgaLibraryId, setKomgaLibraryId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [destinationPendingRemoval, setDestinationPendingRemoval] = useState<
    SettingsBootstrap["destinations"][number] | null
  >(null);

  const settings = asyncResultValue(settingsResult);
  const pushSettings = asyncResultValue(pushSettingsResult);
  const browserPushClientStateValue = asyncResultValue(clientStateResult);

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
    if (!settings) {
      return;
    }

    setInAppEnabled(settings.notifications.inAppEnabled);
  }, [settings]);

  useEffect(() => {
    if (!pushSettings) {
      return;
    }

    setNotifyOnDownloadCompleted(pushSettings.notifyOnDownloadCompleted);
    setNotifyOnDownloadFailed(pushSettings.notifyOnDownloadFailed);
    setNotifyOnTrackedSeriesUpdate(pushSettings.notifyOnTrackedSeriesUpdate);
    setNotifyOnSystemWarning(pushSettings.notifyOnSystemWarning);
  }, [pushSettings]);

  const hasBrowserPushPreferenceChanges = useMemo(() => {
    if (!pushSettings) {
      return false;
    }

    return (
      notifyOnDownloadCompleted !== pushSettings.notifyOnDownloadCompleted ||
      notifyOnDownloadFailed !== pushSettings.notifyOnDownloadFailed ||
      notifyOnTrackedSeriesUpdate !==
        pushSettings.notifyOnTrackedSeriesUpdate ||
      notifyOnSystemWarning !== pushSettings.notifyOnSystemWarning
    );
  }, [
    notifyOnDownloadCompleted,
    notifyOnDownloadFailed,
    notifyOnTrackedSeriesUpdate,
    notifyOnSystemWarning,
    pushSettings,
  ]);

  const isLoading =
    asyncResultLoading(settingsResult) ||
    asyncResultLoading(pushSettingsResult) ||
    asyncResultLoading(clientStateResult);

  const pageError =
    asyncResultError(settingsResult) ??
    asyncResultError(pushSettingsResult) ??
    asyncResultError(clientStateResult);

  const isCurrentBrowserPushEnabled = Boolean(
    pushSettings?.isEnabled &&
    browserPushClientStateValue?.isSubscribed &&
    browserPushClientStateValue?.permission === "granted"
  );

  const browserPushPermissionLabel =
    browserPushClientStateValue?.permission === "secureContextRequired"
      ? "requires HTTPS"
      : (browserPushClientStateValue?.permission ?? "unknown");

  const isBrowserPushTogglePending = isConnectingPush || isDisconnectingPush;

  const handleBrowserPushToggle = async (checked: boolean) => {
    if (!(pushSettings && browserPushClientStateValue)) {
      return;
    }

    if (checked) {
      if (!pushSettings.vapidPublicKey) {
        return;
      }

      const subscription = await subscribeCurrentBrowserToPush(
        pushSettings.vapidPublicKey
      );

      await notifyMutation(
        connectCurrentBrowserPush({
          payload: { ...subscription, userAgent: navigator.userAgent },
          reactivityKeys: [
            reactivityKey.browserPushClientState,
            reactivityKey.browserPushSettings,
          ],
        }),
        {
          failure: "Unable to connect this browser for notifications",
          success: "Browser notifications enabled on this browser",
        }
      );

      return;
    }

    const endpoint = await unsubscribeCurrentBrowserFromPush();

    if (!endpoint) {
      return;
    }

    await notifyMutation(
      disconnectCurrentBrowserPush({
        payload: { endpoint },
        reactivityKeys: [
          reactivityKey.browserPushClientState,
          reactivityKey.browserPushSettings,
        ],
      }),
      {
        failure: "Unable to disconnect this browser",
        success: "Browser notifications disabled on this browser",
      }
    );
  };

  const sendTestNotification = async (): Promise<void> => {
    try {
      const result = await sendBrowserPushTestRequest({
        reactivityKeys: [reactivityKey.browserPushSettings],
      });
      const { deliveredCount: delivered } = result;

      toast.success(
        delivered === 1
          ? "Test notification sent"
          : `Test notification sent to ${delivered} browsers`
      );
    } catch (sendError) {
      toast.error(
        getErrorMessage(sendError, "Unable to send a browser test notification")
      );
    }
  };

  const addDestination = async (): Promise<void> => {
    const saved = await notifyMutation(
      createDestinationRequest({
        payload: { absolutePath, isDefault, komgaLibraryId, name },
        reactivityKeys: [reactivityKey.settingsBootstrap],
      }),
      { failure: "Unable to save destination", success: "Destination saved" }
    );

    if (saved) {
      setAbsolutePath("");
      setIsDefault(false);
      setKomgaLibraryId("");
      setName("");
    }
  };

  const removeDestination = async (destinationId: string): Promise<void> => {
    const removed = await notifyMutation(
      deleteDestinationRequest({
        params: { destinationId },
        reactivityKeys: [
          reactivityKey.settingsBootstrap,
          reactivityKey.library,
          reactivityKey.librarySeriesState,
        ],
      }),
      {
        failure: "Unable to remove destination",
        success: "Destination removed",
      }
    );

    if (removed) {
      setDestinationPendingRemoval(null);
    }
  };

  const unreadCount = settings?.notifications.unreadCount ?? 0;
  const permission = browserPushClientStateValue?.permission;
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

      {pageError === undefined ? null : (
        <Alert variant="destructive">
          <AlertTitle>Unable to load settings</AlertTitle>
          <AlertDescription>
            {getErrorMessage(pageError, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      )}

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
                    {settings?.profile.name ?? "Not set"}
                  </dd>
                </div>
                <div className="row">
                  <dt className="meta">Email</dt>
                  <dd className="text-sm">
                    {settings?.profile.email ?? "Not set"}
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
                    isSavingNotificationPreferences ||
                    inAppEnabled ===
                      (settings?.notifications.inAppEnabled ?? true)
                  }
                  onClick={() => {
                    void notifyMutation(
                      saveNotificationPreferences({
                        payload: { inAppEnabled },
                        reactivityKeys: [
                          reactivityKey.notificationPreferences,
                          reactivityKey.settingsBootstrap,
                        ],
                      }),
                      {
                        failure: "Unable to update notification settings",
                        success: "Notification settings updated",
                      }
                    );
                  }}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {isSavingNotificationPreferences ? "Saving..." : "Save"}
                </Button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Browser notifications</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <StatusBadge
                    tone={
                      browserPushClientStateValue?.isSupported
                        ? "success"
                        : "neutral"
                    }
                  >
                    {browserPushClientStateValue?.isSupported
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
                    !pushSettings?.isConfigured ||
                    !browserPushClientStateValue?.isSupported ||
                    !browserPushClientStateValue?.isSecureContext
                  }
                  label="Enable on this browser"
                  onCheckedChange={(checked) => {
                    void handleBrowserPushToggle(checked);
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
                      {formatDateTime(pushSettings?.lastDeliveredAt)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="meta">Last error</dt>
                    <dd className="text-xs">
                      {pushSettings?.lastError ?? "None"}
                    </dd>
                  </div>
                </dl>

                {pushSettings?.isConfigured ? null : (
                  <Alert>
                    <AlertTitle>Browser push is not configured</AlertTitle>
                    <AlertDescription>
                      Add VAPID keys on the server before enabling browser
                      notifications.
                    </AlertDescription>
                  </Alert>
                )}

                {browserPushClientStateValue?.permission === "denied" ? (
                  <Alert variant="destructive">
                    <AlertTitle>Browser permission is blocked</AlertTitle>
                    <AlertDescription>
                      Re-enable notifications in your browser site settings.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {browserPushClientStateValue?.isSupported &&
                !browserPushClientStateValue.isSecureContext ? (
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
                    isSavingBrowserPushPreferences ||
                    !hasBrowserPushPreferenceChanges
                  }
                  onClick={() => {
                    void notifyMutation(
                      saveBrowserPushPreferences({
                        payload: {
                          isEnabled: pushSettings?.isEnabled ?? false,
                          notifyOnDownloadCompleted,
                          notifyOnDownloadFailed,
                          notifyOnSystemWarning,
                          notifyOnTrackedSeriesUpdate,
                        },
                        reactivityKeys: [reactivityKey.browserPushSettings],
                      }),
                      {
                        failure:
                          "Unable to update browser notification settings",
                        success: "Browser notification settings updated",
                      }
                    );
                  }}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {isSavingBrowserPushPreferences ? "Saving..." : "Save"}
                </Button>
                <Button
                  disabled={
                    isSendingPushTest ||
                    !pushSettings?.isConfigured ||
                    !isCurrentBrowserPushEnabled
                  }
                  onClick={() => {
                    void sendTestNotification();
                  }}
                  size="lg"
                  type="button"
                >
                  {isSendingPushTest ? "Sending..." : "Send test notification"}
                </Button>
              </div>
            </section>
          </div>

          <section className="panel h-fit">
            <div className="panel-header">
              <h2 className="panel-title">Destinations</h2>
              <span className="meta">
                {settings?.destinations.length ?? 0} saved
              </span>
            </div>

            {settings?.destinations.length ? (
              <div className="rows">
                {settings.destinations.map((destination) => (
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
                      disabled={isRemovingDestination}
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

                void addDestination();
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
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
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
                    onChange={(event) => {
                      setAbsolutePath(event.target.value);
                    }}
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
                    onChange={(event) => {
                      setKomgaLibraryId(event.target.value);
                    }}
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
                  isSavingDestination ||
                  name.trim().length === 0 ||
                  absolutePath.trim().length === 0
                }
                size="lg"
                type="submit"
              >
                {isSavingDestination ? "Saving..." : "Save destination"}
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

                void removeDestination(destinationId);
              }}
              type="button"
              variant="destructive"
            >
              {isRemovingDestination ? "Removing..." : "Remove"}
            </Button>
            <Button
              disabled={isRemovingDestination}
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
};

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  component: SettingsRouteComponent,
});
