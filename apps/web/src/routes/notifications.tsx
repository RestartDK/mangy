import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { Button } from "@/components/ui/button";
import { useMarkAllNotificationsRead } from "@/hooks/use-mark-all-notifications-read";
import { useMarkNotificationRead } from "@/hooks/use-mark-notification-read";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useNotifications } from "@/hooks/use-notifications";
import { requireAuth } from "@/lib/require-auth";

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
    <AppShell
      subtitle="In-app notifications now capture queue results and tracked-series updates, with Slack still able to layer on later without changing the core event flow."
      title="Notification stream"
    >
      <PlaceholderPanel
        description="Completed downloads, final queue failures, and tracked-series updates appear here first, while Slack delivery can build on the same pipeline later."
        eyebrow="In-app"
        title={`Messages: ${notificationsQuery.data?.length ?? 0}`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-background/70 p-4">
          <div>
            <div className="font-medium text-sm">Unread notifications</div>
            <div className="mt-1 text-muted-foreground text-sm">
              {preferencesQuery.data?.unreadCount ?? 0} unread in the in-app
              feed
            </div>
          </div>
          <Button
            disabled={markAllNotificationsRead.isPending}
            onClick={() => {
              markAllNotificationsRead.mutate();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {markAllNotificationsRead.isPending
              ? "Working..."
              : "Mark all read"}
          </Button>
        </div>

        <div className="grid gap-3">
          {notificationsQuery.data?.map((item) => (
            <div
              className="rounded-[20px] border border-border/60 bg-background/70 p-4"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{item.title}</div>
                    {item.isRead ? null : (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary uppercase tracking-[0.14em]">
                        Unread
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-muted-foreground text-sm">
                    {item.body}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    {item.type}
                  </div>
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
            </div>
          ))}
        </div>
      </PlaceholderPanel>
    </AppShell>
  );
}
