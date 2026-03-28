import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function NotificationsRouteComponent() {
  const notificationsQuery = useNotifications();
  const preferencesQuery = useNotificationPreferences();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();

  return (
    <AppShell>
      <PageHeader
        action={
          <Button
            disabled={markAllNotificationsRead.isPending}
            onClick={() => {
              markAllNotificationsRead.mutate();
            }}
            variant="outline"
          >
            {markAllNotificationsRead.isPending
              ? "Working..."
              : "Mark all read"}
          </Button>
        }
        description="Keep up with completed downloads, failures, and tracked-series updates in one inbox."
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

      <Card size="sm">
        <CardHeader className="gap-1">
          <CardTitle>Inbox</CardTitle>
          <p className="text-muted-foreground text-sm">
            {preferencesQuery.data?.unreadCount ?? 0} unread messages
          </p>
        </CardHeader>
      </Card>

      {notificationsQuery.isLoading ? <NotificationsSkeleton /> : null}

      {notificationsQuery.isLoading ||
      (notificationsQuery.data?.length ?? 0) ? null : (
        <EmptyState
          description="When downloads finish or tracked series change, updates will show up here."
          title="No notifications yet"
        />
      )}

      <div className="grid gap-3">
        {notificationsQuery.data?.map((item) => (
          <Card
            className={cn(
              item.isRead
                ? "border-border/70"
                : "border-primary/30 bg-accent/40"
            )}
            key={item.id}
            size="sm"
          >
            <CardContent className="space-y-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{item.title}</h2>
                    <NotificationTypeBadge type={item.type} />
                    {item.isRead ? null : (
                      <StatusBadge tone="secondary">Unread</StatusBadge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{item.body}</p>
                </div>
                <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
                  <span className="text-muted-foreground">
                    {formatDateTime(item.createdAt)}
                  </span>
                  {item.isRead ? null : (
                    <Button
                      disabled={markNotificationRead.isPending}
                      onClick={() => {
                        markNotificationRead.mutate(item.id);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

const NotificationTypeBadge = ({
  type,
}: {
  type: NotificationItem["type"];
}) => {
  if (type === "downloadCompleted") {
    return <StatusBadge tone="secondary">Download complete</StatusBadge>;
  }

  if (type === "downloadFailed") {
    return <StatusBadge tone="destructive">Download failed</StatusBadge>;
  }

  if (type === "trackedSeriesUpdated") {
    return <StatusBadge>Tracked series</StatusBadge>;
  }

  return <StatusBadge>System</StatusBadge>;
};

const NotificationsSkeleton = () => (
  <div className="grid gap-3">
    {Array.from({ length: 4 }).map((_, index) => (
      <Card key={String(index)} size="sm">
        <CardContent className="space-y-3 py-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/4" />
        </CardContent>
      </Card>
    ))}
  </div>
);
