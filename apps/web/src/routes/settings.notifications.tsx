import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { reactivityKey } from "@/atoms/keys";
import { updateNotificationPreferences } from "@/atoms/notifications";
import { settingsBootstrapQuery } from "@/atoms/settings";
import { SectionError } from "@/components/settings/section-error";
import { ToggleRow } from "@/components/settings/toggle-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notifyMutation } from "@/lib/notify-mutation";

const NotificationsSkeleton = () => (
  <section className="panel">
    <div className="panel-header">
      <h2 className="panel-title">Notifications</h2>
    </div>
    <div className="rows">
      <div className="row">
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  </section>
);

const NotificationsRouteComponent = () => {
  const settingsResult = useAtomValue(settingsBootstrapQuery);
  const saveNotificationPreferences = useAtomSet(
    updateNotificationPreferences,
    { mode: "promise" }
  );
  const notificationPreferencesResult = useAtomValue(
    updateNotificationPreferences
  );
  const isSaving = AsyncResult.isWaiting(notificationPreferencesResult);
  const [inAppDraft, setInAppDraft] = useState<boolean>();

  const settings = Option.getOrUndefined(AsyncResult.value(settingsResult));

  if (AsyncResult.isInitial(settingsResult)) {
    return <NotificationsSkeleton />;
  }

  const serverInAppEnabled = settings?.notifications.inAppEnabled ?? true;
  const inAppEnabled = inAppDraft ?? serverInAppEnabled;
  const unreadCount = settings?.notifications.unreadCount ?? 0;

  const saveInAppPreference = async (): Promise<void> => {
    const saved = await notifyMutation(
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

    if (saved) {
      setInAppDraft(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionError
        cause={AsyncResult.cause(settingsResult)}
        title="Unable to load notification settings"
      />

      {settings === undefined ? null : (
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
              onCheckedChange={setInAppDraft}
            />
          </div>
          <div className="border-border flex justify-end border-t px-4 py-3">
            <Button
              disabled={isSaving || inAppEnabled === serverInAppEnabled}
              onClick={() => {
                void saveInAppPreference();
              }}
              size="lg"
              type="button"
              variant="outline"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationsRouteComponent,
});
