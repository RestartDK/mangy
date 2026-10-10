import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock3, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <AppShell>
      <PageHeader
        description="Monitor what is running now, retry what needs attention, and keep finished jobs in view."
        title="Queue"
      />

      {downloadsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the queue</AlertTitle>
          <AlertDescription>
            {getErrorMessage(downloadsQuery.error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper="Queued or running now"
          icon={<Clock3 className="size-4" />}
          label="In progress"
          value={activeJobs.length}
        />
        <MetricCard
          helper="Waiting for another attempt"
          icon={<RotateCcw className="size-4" />}
          label="Retrying"
          value={retryJobs.length}
        />
        <MetricCard
          helper="Finished successfully"
          icon={<CheckCircle2 className="size-4" />}
          label="Completed"
          value={completedJobs.length}
        />
        <MetricCard
          helper="Needs manual attention"
          icon={<AlertCircle className="size-4" />}
          label="Failed"
          value={failedJobs.length}
        />
      </div>

      {downloadsQuery.isLoading ? <QueueSkeleton /> : null}

      {!downloadsQuery.isLoading && jobs.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link to="/search">Search for a series</Link>
            </Button>
          }
          description="Queue a chapter from a series page and it will appear here with progress, retries, and actions."
          title="No jobs yet"
        />
      ) : null}

      {jobs.length ? (
        <Tabs className="page-section" defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              In progress ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="retrying">
              Retrying ({retryJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed ({failedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({cancelledJobs.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            <QueueList
              cancelDownload={cancelDownload}
              jobs={activeJobs}
              prioritizeDownload={prioritizeDownload}
              retryDownload={retryDownload}
              title="Queued and running"
            />
          </TabsContent>
          <TabsContent value="retrying">
            <QueueList
              cancelDownload={cancelDownload}
              jobs={retryJobs}
              prioritizeDownload={prioritizeDownload}
              retryDownload={retryDownload}
              title="Waiting to retry"
            />
          </TabsContent>
          <TabsContent value="completed">
            <QueueList
              cancelDownload={cancelDownload}
              jobs={completedJobs}
              prioritizeDownload={prioritizeDownload}
              retryDownload={retryDownload}
              title="Finished downloads"
            />
          </TabsContent>
          <TabsContent value="failed">
            <QueueList
              cancelDownload={cancelDownload}
              jobs={failedJobs}
              prioritizeDownload={prioritizeDownload}
              retryDownload={retryDownload}
              title="Needs attention"
            />
          </TabsContent>
          <TabsContent value="cancelled">
            <QueueList
              cancelDownload={cancelDownload}
              jobs={cancelledJobs}
              prioritizeDownload={prioritizeDownload}
              retryDownload={retryDownload}
              title="Cancelled jobs"
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </AppShell>
  );
}

interface QueueListProps {
  cancelDownload: ReturnType<typeof useCancelDownload>;
  jobs: DownloadItem[];
  prioritizeDownload: ReturnType<typeof usePrioritizeDownload>;
  retryDownload: ReturnType<typeof useRetryDownload>;
  title: string;
}

const QueueList = ({
  cancelDownload,
  jobs,
  prioritizeDownload,
  retryDownload,
  title,
}: QueueListProps) => {
  if (jobs.length === 0) {
    return (
      <EmptyState
        description="There are no jobs in this status right now."
        title={`Nothing in ${title.toLowerCase()}`}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((item) => (
          <article className="rounded-lg border p-4" key={item.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">
                    {item.seriesTitle ?? "Queued chapter"}
                  </h3>
                  <QueueStatusBadge status={item.status} />
                </div>
                <p className="text-muted-foreground text-sm">
                  {item.chapterTitle ??
                    item.chapterId ??
                    "Chapter details pending"}
                </p>
                <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                  <span>
                    Destination: {item.destinationName ?? "Not assigned"}
                  </span>
                  <span>
                    Attempts: {item.attempts} of {item.maxAttempts}
                  </span>
                  <span>
                    Updated:{" "}
                    {formatDateTime(item.completedAt ?? item.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-52">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>{item.progressPercent}%</span>
                </div>
                <Progress value={item.progressPercent} />
              </div>
            </div>

            {item.errorMessage ? (
              <Alert className="mt-4" variant="destructive">
                <AlertTitle>Job error</AlertTitle>
                <AlertDescription>{item.errorMessage}</AlertDescription>
              </Alert>
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
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              ) : null}

              {item.status === "queued" || item.status === "retryableFailed" ? (
                <Button
                  disabled={prioritizeDownload.isPending}
                  onClick={() => {
                    prioritizeDownload.mutate(item.id);
                  }}
                  type="button"
                  variant="outline"
                >
                  Prioritize
                </Button>
              ) : null}

              {item.status === "retryableFailed" ||
              item.status === "cancelled" ? (
                <Button
                  disabled={retryDownload.isPending}
                  onClick={() => {
                    retryDownload.mutate(item.id);
                  }}
                  type="button"
                >
                  Retry
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
};

const QueueStatusBadge = ({ status }: { status: DownloadItem["status"] }) => {
  if (status === "completed") {
    return <StatusBadge tone="secondary">Completed</StatusBadge>;
  }

  if (status === "retryableFailed") {
    return <StatusBadge tone="destructive">Retrying</StatusBadge>;
  }

  if (status === "cancelled") {
    return <StatusBadge>Cancelled</StatusBadge>;
  }

  if (status === "running") {
    return <StatusBadge tone="secondary">Running</StatusBadge>;
  }

  return <StatusBadge tone="secondary">Queued</StatusBadge>;
};

const QueueSkeleton = () => (
  <Card>
    <CardContent className="space-y-4 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="space-y-3 rounded-lg border p-4" key={String(index)}>
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </CardContent>
  </Card>
);
