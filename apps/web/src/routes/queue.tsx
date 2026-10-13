import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { DownloadJobId } from "@mangy/contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { RotateCcw, X } from "lucide-react";

import {
  cancelDownload as cancelDownloadAtom,
  downloadsQuery,
  retryDownload as retryDownloadAtom,
} from "@/atoms/downloads";
import type { DownloadItem } from "@/atoms/downloads";
import { reactivityKey } from "@/atoms/keys";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCause, formatDateTime } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";
import { requireAuth } from "@/lib/require-auth";

const sortQueuedJobs = <T extends { createdAt: string }>(items: T[]): T[] =>
  [...items].toSorted(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

const sortFinishedJobs = <T extends { updatedAt: string }>(items: T[]): T[] =>
  [...items].toSorted(
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

interface QueueListProps {
  empty: string;
  isCancelling: boolean;
  isRetrying: boolean;
  jobs: DownloadItem[];
  onCancel: (jobId: DownloadJobId) => void;
  onRetry: (jobId: DownloadJobId) => void;
}

const QueueList = ({
  empty,
  isCancelling,
  isRetrying,
  jobs,
  onCancel,
  onRetry,
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
                  {Option.getOrElse(item.seriesTitle, () => "Queued chapter")}
                </h3>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              </div>
              <p className="meta truncate">
                {Option.getOrElse(item.chapterTitle, () =>
                  Option.getOrElse(
                    item.chapterId,
                    () => "Chapter details pending"
                  )
                )}
              </p>
              <p className="meta truncate">
                {Option.getOrElse(item.destinationName, () => "No destination")}{" "}
                · Attempt {item.attempts} of {item.maxAttempts} ·{" "}
                {formatDateTime(
                  Option.getOrElse(item.completedAt, () => item.updatedAt)
                )}
              </p>
              {Option.isSome(item.errorMessage) ? (
                <p className="text-destructive text-xs">
                  {item.errorMessage.value}
                </p>
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
                {isActive || item.status === "retryableFailed" ? (
                  <Button
                    disabled={isCancelling}
                    onClick={() => {
                      onCancel(item.id);
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
                    disabled={isRetrying}
                    onClick={() => {
                      onRetry(item.id);
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
const QueueRouteComponent = () => {
  const downloads = useAtomValue(downloadsQuery);
  const cancelDownload = useAtomSet(cancelDownloadAtom, { mode: "promise" });
  const retryDownload = useAtomSet(retryDownloadAtom, { mode: "promise" });
  const cancelResult = useAtomValue(cancelDownloadAtom);
  const retryResult = useAtomValue(retryDownloadAtom);
  const jobs = Option.getOrElse(AsyncResult.value(downloads), () => []);
  const error = AsyncResult.cause(downloads);
  const isLoading = AsyncResult.isInitial(downloads);
  const isCancelling = AsyncResult.isWaiting(cancelResult);
  const isRetrying = AsyncResult.isWaiting(retryResult);

  const onCancel = (jobId: DownloadJobId): void => {
    void notifyMutation(
      cancelDownload({
        params: { jobId },
        reactivityKeys: [reactivityKey.downloads],
      }),
      { failure: "Unable to cancel job", success: "Job cancelled" }
    );
  };

  const onRetry = (jobId: DownloadJobId): void => {
    void notifyMutation(
      retryDownload({
        params: { jobId },
        reactivityKeys: [reactivityKey.downloads],
      }),
      { failure: "Unable to retry job", success: "Job returned to the queue" }
    );
  };

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

      {Option.isSome(error) ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the queue</AlertTitle>
          <AlertDescription>
            {formatCause(error.value, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <QueueSkeleton /> : null}

      {!isLoading && jobs.length === 0 ? (
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
                empty={view.empty}
                isCancelling={isCancelling}
                isRetrying={isRetrying}
                jobs={view.jobs}
                onCancel={onCancel}
                onRetry={onRetry}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </AppShell>
  );
};

export const Route = createFileRoute("/queue")({
  beforeLoad: requireAuth,
  component: QueueRouteComponent,
});
