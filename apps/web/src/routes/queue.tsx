import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { Button } from "@/components/ui/button";
import { useCancelDownload } from "@/hooks/use-cancel-download";
import { useDownloads } from "@/hooks/use-downloads";
import { usePrioritizeDownload } from "@/hooks/use-prioritize-download";
import { useRetryDownload } from "@/hooks/use-retry-download";
import { requireAuth } from "@/lib/require-auth";

const sortQueuedJobs = <T extends { createdAt: string }>(items: T[]): T[] =>
  [...items].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

const sortFinishedJobs = <T extends { updatedAt: string }>(items: T[]): T[] =>
  [...items].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

export const Route = createFileRoute("/queue")({
  beforeLoad: requireAuth,
  component: QueueRouteComponent,
});

function QueueRouteComponent() {
  const downloadsQuery = useDownloads();
  const cancelDownload = useCancelDownload();
  const retryDownload = useRetryDownload();
  const prioritizeDownload = usePrioritizeDownload();
  const jobs = downloadsQuery.data ?? [];

  const activeJobs = sortQueuedJobs(
    jobs.filter((job) => job.status === "queued" || job.status === "running")
  );
  const retryJobs = sortQueuedJobs(
    jobs.filter(
      (job) =>
        job.status === "retryableFailed" && job.attempts < job.maxAttempts
    )
  );
  const failedJobs = sortFinishedJobs(
    jobs.filter(
      (job) =>
        job.status === "retryableFailed" && job.attempts >= job.maxAttempts
    )
  );
  const completedJobs = sortFinishedJobs(
    jobs.filter((job) => job.status === "completed")
  );
  const cancelledJobs = sortFinishedJobs(
    jobs.filter((job) => job.status === "cancelled")
  );

  const sections = [
    {
      description: "Queued and actively downloading.",
      items: activeJobs,
      title: "In flight",
    },
    {
      description: "Jobs waiting for their next retry window.",
      items: retryJobs,
      title: "Retrying",
    },
    {
      description: "Finished jobs written to disk.",
      items: completedJobs,
      title: "Completed",
    },
    {
      description: "Jobs stopped manually and ready to retry if needed.",
      items: cancelledJobs,
      title: "Cancelled",
    },
    {
      description: "Jobs that exhausted every retry.",
      items: failedJobs,
      title: "Failed",
    },
  ].filter((section) => section.items.length > 0);

  return (
    <AppShell
      subtitle="The queue now runs end to end: chapters are enqueued from series pages, processed by the worker, and refreshed here every few seconds."
      title="Background queue"
    >
      {downloadsQuery.isLoading ? <Loader /> : null}

      {jobs.length === 0 ? (
        <PlaceholderPanel
          description="Queue a chapter from any series page and it will show up here with retries, progress, and destination details."
          eyebrow="Downloads"
          title="No jobs yet"
        />
      ) : null}

      <div className="grid gap-6">
        {sections.map((section) => (
          <section className="panelSurface p-6" key={section.title}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="eyebrow">{section.title}</div>
                <div className="mt-2 text-muted-foreground text-sm">
                  {section.description}
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                {section.items.length} jobs
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {section.items.map((item) => (
                <article
                  className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-base">
                        {item.seriesTitle ?? "Queued chapter"}
                      </div>
                      <div className="mt-1 text-muted-foreground text-sm">
                        {item.chapterTitle ??
                          item.chapterId ??
                          "Chapter metadata pending"}
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground text-sm">
                      <div>{item.status}</div>
                      <div>
                        Attempt {item.attempts} of {item.maxAttempts}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
                    <span>
                      {item.progressPercent}% complete
                      {item.destinationName
                        ? ` -> ${item.destinationName}`
                        : ""}
                    </span>
                    <span>
                      {item.completedAt
                        ? `Finished ${new Date(item.completedAt).toLocaleString()}`
                        : `Updated ${new Date(item.updatedAt).toLocaleString()}`}
                    </span>
                  </div>

                  {item.errorMessage ? (
                    <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive text-sm">
                      {item.errorMessage}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status === "queued" ||
                    item.status === "running" ||
                    item.status === "retryableFailed" ? (
                      <Button
                        disabled={cancelDownload.isPending}
                        onClick={() => {
                          cancelDownload.mutate(item.id);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    ) : null}

                    {item.status === "queued" ||
                    item.status === "retryableFailed" ? (
                      <Button
                        disabled={prioritizeDownload.isPending}
                        onClick={() => {
                          prioritizeDownload.mutate(item.id);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Move to front
                      </Button>
                    ) : null}

                    {item.status === "retryableFailed" ||
                    item.status === "cancelled" ? (
                      <Button
                        disabled={retryDownload.isPending}
                        onClick={() => {
                          retryDownload.mutate(item.id);
                        }}
                        size="sm"
                        type="button"
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
