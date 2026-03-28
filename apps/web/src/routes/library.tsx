import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { useLibrary } from "@/hooks/use-library";
import { useTracking } from "@/hooks/use-tracking";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/library")({
  beforeLoad: requireAuth,
  component: LibraryRouteComponent,
});

function LibraryRouteComponent() {
  const libraryQuery = useLibrary();
  const trackingQuery = useTracking();

  return (
    <AppShell
      subtitle="Queued chapters seed the library automatically, and tracked series now carry real polling state for the worker to process in the background."
      title="Library and tracking"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <PlaceholderPanel
          description="Series land here as soon as you queue a chapter, carrying their destination and tracking preferences forward."
          eyebrow="Library"
          title={`Saved titles: ${libraryQuery.data?.length ?? 0}`}
        >
          <div className="grid gap-3">
            {libraryQuery.data?.map((item) => (
              <div
                className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                key={item.id}
              >
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-muted-foreground text-sm">
                  Tracked: {String(item.isTracked)} | Auto-download:{" "}
                  {String(item.autoDownload)}
                </div>
                <div className="mt-1 text-muted-foreground text-sm">
                  Destination: {item.destinationName ?? "Not assigned"}
                </div>
              </div>
            ))}
          </div>
        </PlaceholderPanel>

        <PlaceholderPanel
          description="The worker now polls these entries in the background and can queue new chapters automatically when auto-download is enabled."
          eyebrow="Tracking"
          title={`Tracked series: ${trackingQuery.data?.length ?? 0}`}
        >
          <div className="grid gap-3">
            {trackingQuery.data?.map((item) => (
              <div
                className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                key={item.id}
              >
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-muted-foreground text-sm">
                  Last checked: {item.lastCheckedAt ?? "Not checked yet"}
                </div>
                <div className="mt-1 text-muted-foreground text-sm">
                  Next check: {item.nextCheckAt ?? "Not scheduled yet"}
                </div>
              </div>
            ))}
          </div>
        </PlaceholderPanel>
      </div>
    </AppShell>
  );
}
