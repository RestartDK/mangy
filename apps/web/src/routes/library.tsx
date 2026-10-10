import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibrary } from "@/hooks/use-library";
import { useRemoveLibrarySeries } from "@/hooks/use-remove-library-series";
import { useTracking } from "@/hooks/use-tracking";
import { formatDateTime, getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/library")({
  beforeLoad: requireAuth,
  component: LibraryRouteComponent,
});

interface LibraryRouteItem {
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
}

function LibraryRouteComponent() {
  const libraryQuery = useLibrary();
  const trackingQuery = useTracking();
  const removeLibrarySeries = useRemoveLibrarySeries();
  const [seriesPendingRemoval, setSeriesPendingRemoval] =
    useState<LibraryRouteItem | null>(null);

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

  const items: LibraryRouteItem[] = [...libraryItems, ...trackingOnlyItems];
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
            <LibraryList
              items={items}
              onRemove={(item) => {
                setSeriesPendingRemoval(item);
              }}
            />
          </TabsContent>
          <TabsContent value="tracked">
            <LibraryList
              items={trackedItems}
              onRemove={(item) => {
                setSeriesPendingRemoval(item);
              }}
            />
          </TabsContent>
          <TabsContent value="auto">
            <LibraryList
              items={autoDownloadItems}
              onRemove={(item) => {
                setSeriesPendingRemoval(item);
              }}
            />
          </TabsContent>
          <TabsContent value="needs-destination">
            <LibraryList
              items={needsDestinationItems}
              onRemove={(item) => {
                setSeriesPendingRemoval(item);
              }}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSeriesPendingRemoval(null);
          }
        }}
        open={seriesPendingRemoval !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove series</DialogTitle>
            <DialogDescription>
              {seriesPendingRemoval
                ? `Remove ${seriesPendingRemoval.title} from your library? This also stops tracking for this series, but it does not delete files already on disk or cancel existing download jobs.`
                : "Remove this series from your library?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!seriesPendingRemoval) {
                  return;
                }

                removeLibrarySeries
                  .mutateAsync({
                    seriesId: seriesPendingRemoval.seriesId,
                    sourceId: seriesPendingRemoval.sourceId,
                  })
                  .then(() => {
                    setSeriesPendingRemoval(null);
                  })
                  .catch(() => undefined);
              }}
              type="button"
              variant="destructive"
            >
              {removeLibrarySeries.isPending ? "Removing..." : "Remove"}
            </Button>
            <Button
              disabled={removeLibrarySeries.isPending}
              onClick={() => {
                setSeriesPendingRemoval(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

interface LibraryListProps {
  items: LibraryRouteItem[];
  onRemove: (item: LibraryRouteItem) => void;
}

const LibraryList = ({ items, onRemove }: LibraryListProps) => {
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
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link
                    params={{
                      seriesId: item.seriesId,
                      sourceId: item.sourceId,
                    }}
                    to="/series/$sourceId/$seriesId"
                  >
                    Manage
                  </Link>
                </Button>
                <Button
                  onClick={() => {
                    onRemove(item);
                  }}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
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
            <div className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs tracking-wide uppercase">
                  Last checked
                </div>
                <div className="text-foreground mt-1">
                  {formatDateTime(item.trackingState?.lastCheckedAt)}
                </div>
              </div>
              <div>
                <div className="text-xs tracking-wide uppercase">
                  Next check
                </div>
                <div className="text-foreground mt-1">
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
