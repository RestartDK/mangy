import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { toast } from "sonner";

import { reactivityKey } from "@/atoms/keys";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationPreferencesQuery,
  notificationsQuery,
} from "@/atoms/notifications";
import type { NotificationItem } from "@/atoms/notifications";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCause, formatDateTime, getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import { cn } from "@/lib/utils";

const notificationTypeLabels: Record<
  NotificationItem["type"],
  { label: string; tone: StatusTone }
> = {
  downloadCompleted: { label: "Download complete", tone: "success" },
  downloadFailed: { label: "Download failed", tone: "danger" },
  systemWarning: { label: "System", tone: "warning" },
  trackedSeriesUpdated: { label: "Tracked series", tone: "brand" },
};

const NotificationsSkeleton = () => (
  <div className="panel rows">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="row" key={String(index)}>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    ))}
  </div>
);
const NotificationsRouteComponent = () => {
  const notifications = useAtomValue(notificationsQuery);
  const preferences = useAtomValue(notificationPreferencesQuery);
  const markRead = useAtomSet(markNotificationRead, { mode: "promise" });
  const markAllRead = useAtomSet(markAllNotificationsRead, { mode: "promise" });
  const markAllResult = useAtomValue(markAllNotificationsRead);
  const markReadResult = useAtomValue(markNotificationRead);
  const unreadCount = Option.match(AsyncResult.value(preferences), {
    onNone: () => 0,
    onSome: (value) => value.unreadCount,
  });
  const items = Option.getOrElse(AsyncResult.value(notifications), () => []);
  const error = Option.orElse(AsyncResult.cause(notifications), () =>
    AsyncResult.cause(preferences)
  );
  const isLoading = AsyncResult.isInitial(notifications);
  const isMarkingAllRead = AsyncResult.isWaiting(markAllResult);
  const isMarkingRead = AsyncResult.isWaiting(markReadResult);

  const markAll = async (): Promise<void> => {
    try {
      const result = await markAllRead({
        reactivityKeys: [
          reactivityKey.notifications,
          reactivityKey.notificationPreferences,
          reactivityKey.settingsBootstrap,
        ],
      });
      const { updatedCount } = result;

      toast.success(
        updatedCount
          ? `${updatedCount} notifications marked as read`
          : "All notifications are already read"
      );
    } catch (markError) {
      toast.error(getErrorMessage(markError, "Unable to update notifications"));
    }
  };

  return (
    <AppShell>
      <PageHeader
        action={
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <span className="meta">
              {unreadCount === 0 ? "All read" : `${unreadCount} unread`}
            </span>
            <Button
              disabled={isMarkingAllRead || unreadCount === 0}
              onClick={() => {
                void markAll();
              }}
              size="lg"
              variant="outline"
            >
              {isMarkingAllRead ? "Working..." : "Mark all read"}
            </Button>
          </div>
        }
        title="Notifications"
      />

      {Option.isSome(error) ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load notifications</AlertTitle>
          <AlertDescription>
            {formatCause(error.value, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <NotificationsSkeleton /> : null}

      {isLoading || items.length ? null : (
        <EmptyState
          description="Download and tracking updates land here."
          title="No notifications yet"
        />
      )}

      {items.length ? (
        <div className="panel rows">
          {items.map((item) => {
            const type = notificationTypeLabels[item.type];

            return (
              <article
                className={cn("row", item.isRead ? null : "bg-accent/40")}
                key={item.id}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {item.isRead ? null : (
                      <span
                        aria-label="Unread"
                        className="bg-brand size-1.5 shrink-0 rounded-full"
                        role="img"
                      />
                    )}
                    <h2 className="text-sm font-medium break-words">
                      {item.title}
                    </h2>
                    <StatusBadge tone={type.tone}>{type.label}</StatusBadge>
                  </div>
                  <p className="meta break-words whitespace-pre-line">
                    {item.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="meta">{formatDateTime(item.createdAt)}</span>
                  {item.isRead ? null : (
                    <Button
                      disabled={isMarkingRead}
                      onClick={() => {
                        void markRead({
                          params: { notificationId: item.id },
                          reactivityKeys: [
                            reactivityKey.notifications,
                            reactivityKey.notificationPreferences,
                            reactivityKey.settingsBootstrap,
                          ],
                        });
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </AppShell>
  );
};

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuth,
  component: NotificationsRouteComponent,
});
