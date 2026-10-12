import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { toast } from "sonner";

import { reactivityKey } from "@/atoms/keys";
import {
  browserPushClientState,
  browserPushSettingsQuery,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  updateBrowserPushPreferences,
} from "@/atoms/settings";
import { SectionError } from "@/components/settings/section-error";
import { ToggleRow } from "@/components/settings/toggle-row";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
} from "@/lib/browser-push";
import { formatDateTime, getErrorMessage, hasText } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";

const eventPreferences = [
  {
    description: "A chapter finishes downloading.",
    key: "notifyOnDownloadCompleted",
    label: "Download completed",
  },
  {
    description: "Retries are exhausted and action is needed.",
    key: "notifyOnDownloadFailed",
    label: "Download failed",
  },
  {
    description: "Tracked series queue new chapters.",
    key: "notifyOnTrackedSeriesUpdate",
    label: "Tracked series updates",
  },
  {
    description: "Tracking or import issues need attention.",
    key: "notifyOnSystemWarning",
    label: "System warnings",
  },
] as const;

type EventPreferenceKey = (typeof eventPreferences)[number]["key"];

const BrowserNotificationsSkeleton = () => (
  <section className="panel">
    <div className="panel-header">
      <h2 className="panel-title">Browser notifications</h2>
    </div>
    <div className="rows">
      {[0, 1, 2].map((index) => (
        <div className="row" key={String(index)}>
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const BrowserNotificationsRouteComponent = () => {
  const pushSettingsResult = useAtomValue(browserPushSettingsQuery);
  const clientStateResult = useAtomValue(browserPushClientState);
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
  const browserPushPreferencesResult = useAtomValue(
    updateBrowserPushPreferences
  );
  const connectPushResult = useAtomValue(savePushSubscription);
  const disconnectPushResult = useAtomValue(removePushSubscription);
  const sendPushTestResult = useAtomValue(sendTestPush);
  const isSaving = AsyncResult.isWaiting(browserPushPreferencesResult);
  const isConnectingPush = AsyncResult.isWaiting(connectPushResult);
  const isDisconnectingPush = AsyncResult.isWaiting(disconnectPushResult);
  const isSendingPushTest = AsyncResult.isWaiting(sendPushTestResult);
  const [preferencesDraft, setPreferencesDraft] = useState<
    Partial<Record<EventPreferenceKey, boolean>>
  >({});

  const pushSettings = Option.getOrUndefined(
    AsyncResult.value(pushSettingsResult)
  );
  const browserPushClientStateValue = Option.getOrUndefined(
    AsyncResult.value(clientStateResult)
  );

  if (
    AsyncResult.isInitial(pushSettingsResult) ||
    AsyncResult.isInitial(clientStateResult)
  ) {
    return <BrowserNotificationsSkeleton />;
  }

  const pageError = Option.orElse(AsyncResult.cause(pushSettingsResult), () =>
    AsyncResult.cause(clientStateResult)
  );
  const serverPreferences: Record<EventPreferenceKey, boolean> = {
    notifyOnDownloadCompleted: pushSettings?.notifyOnDownloadCompleted ?? true,
    notifyOnDownloadFailed: pushSettings?.notifyOnDownloadFailed ?? true,
    notifyOnSystemWarning: pushSettings?.notifyOnSystemWarning ?? true,
    notifyOnTrackedSeriesUpdate:
      pushSettings?.notifyOnTrackedSeriesUpdate ?? true,
  };
  const preferences = { ...serverPreferences, ...preferencesDraft };
  const hasPreferenceChanges = eventPreferences.some(
    (field) => preferences[field.key] !== serverPreferences[field.key]
  );
  const isCurrentBrowserPushEnabled =
    pushSettings?.isEnabled === true &&
    browserPushClientStateValue?.isSubscribed === true &&
    browserPushClientStateValue?.permission === "granted";
  const permissionLabel =
    browserPushClientStateValue?.permission === "secureContextRequired"
      ? "requires HTTPS"
      : (browserPushClientStateValue?.permission ?? "unknown");
  const isBrowserPushTogglePending = isConnectingPush || isDisconnectingPush;
  const isBrowserPushReady =
    pushSettings?.isConfigured === true &&
    browserPushClientStateValue !== undefined &&
    browserPushClientStateValue.isSupported &&
    browserPushClientStateValue.isSecureContext;
  let permissionTone: StatusTone = "neutral";
  if (browserPushClientStateValue?.permission === "granted") {
    permissionTone = "success";
  }
  if (browserPushClientStateValue?.permission === "denied") {
    permissionTone = "danger";
  }

  const handleBrowserPushToggle = async (checked: boolean) => {
    if (!(pushSettings && browserPushClientStateValue)) {
      return;
    }

    if (checked) {
      if (!hasText(pushSettings.vapidPublicKey)) {
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

    if (!hasText(endpoint)) {
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

  const savePreferences = async (): Promise<void> => {
    const saved = await notifyMutation(
      saveBrowserPushPreferences({
        payload: {
          isEnabled: pushSettings?.isEnabled ?? false,
          ...preferences,
        },
        reactivityKeys: [reactivityKey.browserPushSettings],
      }),
      {
        failure: "Unable to update browser notification settings",
        success: "Browser notification settings updated",
      }
    );

    if (saved) {
      setPreferencesDraft({});
    }
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

  return (
    <div className="flex flex-col gap-6">
      <SectionError
        cause={pageError}
        title="Unable to load browser notification settings"
      />

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Browser notifications</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusBadge
              tone={
                browserPushClientStateValue?.isSupported === true
                  ? "success"
                  : "neutral"
              }
            >
              {browserPushClientStateValue?.isSupported === true
                ? "Supported"
                : "Not supported"}
            </StatusBadge>
            <StatusBadge tone={permissionTone}>
              Permission: {permissionLabel}
            </StatusBadge>
          </div>
        </div>

        <div className="rows">
          <ToggleRow
            checked={isCurrentBrowserPushEnabled}
            description="Register this browser for push delivery."
            disabled={isBrowserPushTogglePending || !isBrowserPushReady}
            label="Enable on this browser"
            onCheckedChange={(checked) => {
              void handleBrowserPushToggle(checked);
            }}
          />
          {eventPreferences.map((field) => (
            <ToggleRow
              checked={preferences[field.key]}
              description={field.description}
              key={field.key}
              label={field.label}
              onCheckedChange={(checked) => {
                setPreferencesDraft((current) => ({
                  ...current,
                  [field.key]: checked,
                }));
              }}
            />
          ))}
        </div>

        <div className="space-y-4 px-4 py-4">
          <dl className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="meta">Last delivery</dt>
              <dd className="text-xs">
                {formatDateTime(
                  Option.getOrNull(
                    pushSettings?.lastDeliveredAt ?? Option.none()
                  )
                )}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="meta">Last error</dt>
              <dd className="text-xs">
                {Option.getOrElse(
                  pushSettings?.lastError ?? Option.none(),
                  () => "None"
                )}
              </dd>
            </div>
          </dl>

          {pushSettings?.isConfigured === true ? null : (
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

          {browserPushClientStateValue?.isSupported === true &&
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
            disabled={isSaving || !hasPreferenceChanges}
            onClick={() => {
              void savePreferences();
            }}
            size="lg"
            type="button"
            variant="outline"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            disabled={
              isSendingPushTest ||
              pushSettings?.isConfigured !== true ||
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
  );
};

export const Route = createFileRoute("/settings/browser-notifications")({
  component: BrowserNotificationsRouteComponent,
});
