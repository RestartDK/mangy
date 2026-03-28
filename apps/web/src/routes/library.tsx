import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { useLibrary } from "@/hooks/useLibrary";
import { useTracking } from "@/hooks/useTracking";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/library")({
  beforeLoad: requireAuth,
  component: LibraryRouteComponent,
});

function LibraryRouteComponent() {
  const libraryQuery = useLibrary();
  const trackingQuery = useTracking();

  return (
    <AppShell
      subtitle="The database structure for saved titles and tracked series is already in place, even though creation flows arrive in later phases."
      title="Library foundations"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <PlaceholderPanel
          description="Saved series will appear here once the add-to-library flow lands. The table and API are already ready for it."
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
              </div>
            ))}
          </div>
        </PlaceholderPanel>

        <PlaceholderPanel
          description="Tracked-series state is persisted separately so the worker can later poll and queue newly released chapters without the website being open."
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
              </div>
            ))}
          </div>
        </PlaceholderPanel>
      </div>
    </AppShell>
  );
}
