import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { useDownloads } from "@/hooks/useDownloads";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/queue")({
  beforeLoad: requireAuth,
  component: QueueRouteComponent,
});

function QueueRouteComponent() {
  const downloadsQuery = useDownloads();

  return (
    <AppShell
      subtitle="The durable queue schema and API are live now, with worker execution and enqueue flows arriving in the next implementation slice."
      title="Background queue"
    >
      <PlaceholderPanel
        description="Jobs will be created here once chapter queueing lands. The schema already tracks retries, progress, and destination assignment."
        eyebrow="Downloads"
        title={`Jobs recorded: ${downloadsQuery.data?.length ?? 0}`}
      >
        <div className="grid gap-3">
          {downloadsQuery.data?.map((item) => (
            <div
              className="rounded-[20px] border border-border/60 bg-background/70 p-4"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {item.seriesTitle ?? "Queued chapter"}
                  </div>
                  <div className="mt-1 text-muted-foreground text-sm">
                    {item.chapterTitle ?? "Chapter name pending"}
                  </div>
                </div>
                <div className="text-muted-foreground text-sm">
                  {item.status} · {item.progressPercent}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </PlaceholderPanel>
    </AppShell>
  );
}
