import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuth,
  component: NotificationsRouteComponent,
});

function NotificationsRouteComponent() {
  const notificationsQuery = useNotifications();

  return (
    <AppShell
      subtitle="In-app notifications are already modeled separately from Slack so later delivery channels can be layered in without changing the core event pipeline."
      title="Notification stream"
    >
      <PlaceholderPanel
        description="Notification records will show download results, tracked-series updates, and system warnings once those workflows go live."
        eyebrow="In-app"
        title={`Messages: ${notificationsQuery.data?.length ?? 0}`}
      >
        <div className="grid gap-3">
          {notificationsQuery.data?.map((item) => (
            <div
              className="rounded-[20px] border border-border/60 bg-background/70 p-4"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-muted-foreground text-sm">
                    {item.body}
                  </div>
                </div>
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  {item.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PlaceholderPanel>
    </AppShell>
  );
}
