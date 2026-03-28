import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibrary } from "@/hooks/use-library";
import { useTracking } from "@/hooks/use-tracking";
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/library")({
  beforeLoad: requireAuth,
  component: LibraryRouteComponent,
});

function LibraryRouteComponent() {
  const libraryQuery = useLibrary();
  const trackingQuery = useTracking();

  const trackingMap = new Map(
    (trackingQuery.data ?? []).map((item) => [
      `${item.sourceId}:${item.seriesId}`,
      item,
    ])
  );

  const libraryItems = (libraryQuery.data ?? []).map((item) => ({
    ...item,
    trackingState: trackingMap.get(`${item.sourceId}:${item.seriesId}`) ?? null,
  }));

  const trackingOnlyItems = (trackingQuery.data ?? [])
    .filter(
      (item) =>
        !libraryItems.some(
          (entry) =>
            entry.sourceId === item.sourceId && entry.seriesId === item.seriesId
        )
    )
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      seriesId: item.seriesId,
      title: item.title,
      coverImageUrl: null,
      isTracked: true,
      autoDownload: false,
      destinationName: null,
      updatedAt:
        item.lastCheckedAt ?? item.nextCheckAt ?? new Date().toISOString(),
      trackingState: item,
    }));

  const items = [...libraryItems, ...trackingOnlyItems];
  const trackedItems = items.filter((item) => item.isTracked);
  const autoDownloadItems = items.filter((item) => item.autoDownload);
  const needsDestinationItems = items.filter((item) => !item.destinationName);

  return (
    <AppShell>
      <PageHeader
        description="See every series you are managing, check tracking status, and spot anything missing a destination."
        title="Library"
      />

      {libraryQuery.error || trackingQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the library</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              libraryQuery.error ?? trackingQuery.error,
              "Try again in a moment."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper="Saved or tracked series"
          label="All series"
          value={items.length}
        />
        <MetricCard
          helper="Checking for new chapters"
          label="Tracked"
          value={trackedItems.length}
        />
        <MetricCard
          helper="New releases queue automatically"
          label="Auto-download"
          value={autoDownloadItems.length}
        />
        <MetricCard
          helper="Needs a destination before queueing"
          label="Needs destination"
          value={needsDestinationItems.length}
        />
      </div>

      {libraryQuery.isLoading || trackingQuery.isLoading ? (
        <LibrarySkeleton />
      ) : null}

      {!(libraryQuery.isLoading || trackingQuery.isLoading) &&
      items.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link to="/search">Search for a series</Link>
            </Button>
          }
          description="Save a series from its detail page or start tracking a title to manage it here."
          title="Your library is empty"
        />
      ) : null}

      {items.length ? (
        <Tabs className="page-section" defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="tracked">
              Tracked ({trackedItems.length})
            </TabsTrigger>
            <TabsTrigger value="auto">
              Auto-download ({autoDownloadItems.length})
            </TabsTrigger>
            <TabsTrigger value="needs-destination">
              Needs destination ({needsDestinationItems.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <LibraryList items={items} />
          </TabsContent>
          <TabsContent value="tracked">
            <LibraryList items={trackedItems} />
          </TabsContent>
          <TabsContent value="auto">
            <LibraryList items={autoDownloadItems} />
          </TabsContent>
          <TabsContent value="needs-destination">
            <LibraryList items={needsDestinationItems} />
          </TabsContent>
        </Tabs>
      ) : null}
    </AppShell>
  );
}

interface LibraryListProps {
  items: Array<{
    id: string;
    sourceId: string;
    seriesId: string;
    title: string;
    destinationName: string | null;
    isTracked: boolean;
    autoDownload: boolean;
    trackingState: {
      nextCheckAt: string | null;
      lastCheckedAt: string | null;
    } | null;
  }>;
}

const LibraryList = ({ items }: LibraryListProps) => {
  if (items.length === 0) {
    return (
      <EmptyState
        description="There are no series in this view right now."
        title="Nothing to show"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{item.title}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Destination: {item.destinationName ?? "Not set"}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link
                  params={{ seriesId: item.seriesId, sourceId: item.sourceId }}
                  to="/series/$sourceId/$seriesId"
                >
                  Manage
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={item.isTracked ? "secondary" : "outline"}>
                {item.isTracked ? "Tracked" : "Saved"}
              </StatusBadge>
              <StatusBadge tone={item.autoDownload ? "secondary" : "outline"}>
                {item.autoDownload ? "Auto-download on" : "Auto-download off"}
              </StatusBadge>
              {item.destinationName ? null : (
                <StatusBadge tone="destructive">Needs destination</StatusBadge>
              )}
            </div>
            <div className="grid gap-3 text-muted-foreground text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide">
                  Last checked
                </div>
                <div className="mt-1 text-foreground">
                  {formatDateTime(item.trackingState?.lastCheckedAt)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">
                  Next check
                </div>
                <div className="mt-1 text-foreground">
                  {formatDateTime(item.trackingState?.nextCheckAt)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const LibrarySkeleton = () => (
  <div className="grid gap-4 xl:grid-cols-2">
    {Array.from({ length: 4 }).map((_, index) => (
      <Card key={String(index)}>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);
