import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUp, RotateCcw, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCancelDownload } from "@/hooks/use-cancel-download";
import type { DownloadItem } from "@/hooks/use-downloads";
import { useDownloads } from "@/hooks/use-downloads";
import { usePrioritizeDownload } from "@/hooks/use-prioritize-download";
import { useRetryDownload } from "@/hooks/use-retry-download";
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/queue")({
  beforeLoad: requireAuth,
  component: QueueRouteComponent,
});

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

const resolveJobState = (
  job: DownloadItem
): { label: string; tone: StatusTone } => {
  if (job.status === "completed") {
    return { label: "Completed", tone: "success" };
  }

  if (job.status === "cancelled") {
    return { label: "Cancelled", tone: "neutral" };
  }

  if (job.status === "running") {
    return { label: "Running", tone: "brand" };
  }

  if (job.status === "retryableFailed") {
    return job.attempts >= job.maxAttempts
      ? { label: "Failed", tone: "danger" }
      : { label: "Retrying", tone: "warning" };
  }

  return { label: "Queued", tone: "neutral" };
};

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

  const views = [
    {
      empty: "Nothing is downloading right now.",
      jobs: activeJobs,
      label: "In progress",
      value: "active",
    },
    {
      empty: "Nothing is waiting for another attempt.",
      jobs: retryJobs,
      label: "Retrying",
      value: "retrying",
    },
    {
      empty: "No download has finished yet.",
      jobs: completedJobs,
      label: "Completed",
      value: "completed",
    },
    {
      empty: "No job needs manual attention.",
      jobs: failedJobs,
      label: "Failed",
      value: "failed",
    },
    {
      empty: "No cancelled jobs.",
      jobs: cancelledJobs,
      label: "Cancelled",
      value: "cancelled",
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Queue" />

      {downloadsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the queue</AlertTitle>
          <AlertDescription>
            {getErrorMessage(downloadsQuery.error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {downloadsQuery.isLoading ? <QueueSkeleton /> : null}

      {!downloadsQuery.isLoading && jobs.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link to="/search">Search for a series</Link>
            </Button>
          }
          description="Queue a chapter from a series page and it shows up here with progress and retries."
          icon="download"
          title="No downloads yet"
        />
      ) : null}

      {jobs.length ? (
        <Tabs className="page-section" defaultValue="active">
          <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [&>*]:shrink-0">
            {views.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label} ({view.jobs.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {views.map((view) => (
            <TabsContent key={view.value} value={view.value}>
              <QueueList
                cancelDownload={cancelDownload}
                empty={view.empty}
                jobs={view.jobs}
                prioritizeDownload={prioritizeDownload}
                retryDownload={retryDownload}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </AppShell>
  );
}

interface QueueListProps {
  cancelDownload: ReturnType<typeof useCancelDownload>;
  empty: string;
  jobs: DownloadItem[];
  prioritizeDownload: ReturnType<typeof usePrioritizeDownload>;
  retryDownload: ReturnType<typeof useRetryDownload>;
}

const QueueList = ({
  cancelDownload,
  empty,
  jobs,
  prioritizeDownload,
  retryDownload,
}: QueueListProps) => {
  if (jobs.length === 0) {
    return (
      <EmptyState description={empty} icon="download" title="Queue clear" />
    );
  }

  return (
    <div className="panel rows">
      {jobs.map((item) => {
        const state = resolveJobState(item);
        const isActive = item.status === "queued" || item.status === "running";
        const showProgress = isActive || item.status === "retryableFailed";

        return (
          <article className="row" key={item.id}>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-sm font-medium break-words">
                  {item.seriesTitle ?? "Queued chapter"}
                </h3>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              </div>
              <p className="meta truncate">
                {item.chapterTitle ??
                  item.chapterId ??
                  "Chapter details pending"}
              </p>
              <p className="meta truncate">
                {item.destinationName ?? "No destination"} · Attempt{" "}
                {item.attempts} of {item.maxAttempts} ·{" "}
                {formatDateTime(item.completedAt ?? item.updatedAt)}
              </p>
              {item.errorMessage ? (
                <p className="text-destructive text-xs">{item.errorMessage}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {showProgress ? (
                <div className="w-28 space-y-1.5">
                  <p className="meta tabular-nums">{item.progressPercent}%</p>
                  <Progress value={item.progressPercent} />
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                {item.status === "queued" ||
                item.status === "retryableFailed" ? (
                  <Button
                    disabled={prioritizeDownload.isPending}
                    onClick={() => {
                      prioritizeDownload.mutate(item.id);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUp className="size-3.5" />
                    Prioritize
                  </Button>
                ) : null}
                {isActive || item.status === "retryableFailed" ? (
                  <Button
                    disabled={cancelDownload.isPending}
                    onClick={() => {
                      cancelDownload.mutate(item.id);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-3.5" />
                    Cancel
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
                    variant="outline"
                  >
                    <RotateCcw className="size-3.5" />
                    Retry
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

const QueueSkeleton = () => (
  <div className="panel rows">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="row" key={String(index)}>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);
