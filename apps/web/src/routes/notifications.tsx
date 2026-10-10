import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkAllNotificationsRead } from "@/hooks/use-mark-all-notifications-read";
import { useMarkNotificationRead } from "@/hooks/use-mark-notification-read";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import type { NotificationItem } from "@/hooks/use-notifications";
import { useNotifications } from "@/hooks/use-notifications";
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuth,
  component: NotificationsRouteComponent,
});

const notificationTypeLabels: Record<
  NotificationItem["type"],
  { label: string; tone: StatusTone }
> = {
  downloadCompleted: { label: "Download complete", tone: "success" },
  downloadFailed: { label: "Download failed", tone: "danger" },
  trackedSeriesUpdated: { label: "Tracked series", tone: "brand" },
  systemWarning: { label: "System", tone: "warning" },
};

function NotificationsRouteComponent() {
  const notificationsQuery = useNotifications();
  const preferencesQuery = useNotificationPreferences();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();

  const unreadCount = preferencesQuery.data?.unreadCount ?? 0;
  const notifications = notificationsQuery.data ?? [];

  return (
    <AppShell>
      <PageHeader
        action={
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <span className="meta">
              {unreadCount === 0 ? "All read" : `${unreadCount} unread`}
            </span>
            <Button
              disabled={markAllNotificationsRead.isPending || unreadCount === 0}
              onClick={() => {
                markAllNotificationsRead.mutate();
              }}
              size="lg"
              variant="outline"
            >
              {markAllNotificationsRead.isPending
                ? "Working..."
                : "Mark all read"}
            </Button>
          </div>
        }
        title="Notifications"
      />

      {notificationsQuery.error || preferencesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load notifications</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              notificationsQuery.error ?? preferencesQuery.error,
              "Try again in a moment."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {notificationsQuery.isLoading ? <NotificationsSkeleton /> : null}

      {notificationsQuery.isLoading || notifications.length ? null : (
        <EmptyState
          description="Download and tracking updates land here."
          title="No notifications yet"
        />
      )}

      {notifications.length ? (
        <div className="panel rows">
          {notifications.map((item) => {
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
                      disabled={markNotificationRead.isPending}
                      onClick={() => {
                        markNotificationRead.mutate(item.id);
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
}

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
