import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const isLoading = libraryQuery.isLoading || trackingQuery.isLoading;

  const views = [
    { count: items.length, items, label: "All", value: "all" },
    {
      count: trackedItems.length,
      items: trackedItems,
      label: "Tracked",
      value: "tracked",
    },
    {
      count: autoDownloadItems.length,
      items: autoDownloadItems,
      label: "Auto-download",
      value: "auto",
    },
    {
      count: needsDestinationItems.length,
      items: needsDestinationItems,
      label: "Needs destination",
      value: "needs-destination",
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Library" />

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

      {isLoading ? <LibrarySkeleton /> : null}

      {!isLoading && items.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link to="/search">Search for a series</Link>
            </Button>
          }
          description="Save a series from its page or start tracking it to manage it here."
          title="Your library is empty"
        />
      ) : null}

      {items.length ? (
        <Tabs className="page-section" defaultValue="all">
          <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [&>*]:shrink-0">
            {views.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label} ({view.count})
              </TabsTrigger>
            ))}
          </TabsList>
          {views.map((view) => (
            <TabsContent key={view.value} value={view.value}>
              <LibraryList
                items={view.items}
                onRemove={(item) => {
                  setSeriesPendingRemoval(item);
                }}
              />
            </TabsContent>
          ))}
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
                ? `Remove ${seriesPendingRemoval.title}? Tracking stops, but files on disk stay and running downloads keep going.`
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
    return <EmptyState description="Nothing in this view." title="Empty" />;
  }

  return (
    <div className="panel rows">
      {items.map((item) => {
        const lastCheckedAt = item.trackingState?.lastCheckedAt ?? null;
        const nextCheckAt = item.trackingState?.nextCheckAt ?? null;
        const state = [
          item.isTracked ? "Tracked" : "Saved",
          item.autoDownload ? "Auto-download on" : "Manual",
        ].join(" · ");

        return (
          <div className="row" key={item.id}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  className="max-w-full truncate text-sm font-medium hover:underline"
                  params={{
                    seriesId: item.seriesId,
                    sourceId: item.sourceId,
                  }}
                  title={item.title}
                  to="/series/$sourceId/$seriesId"
                >
                  {item.title}
                </Link>
                {item.destinationName ? null : (
                  <StatusBadge tone="warning">Needs destination</StatusBadge>
                )}
              </div>
              <p className="meta truncate">
                {state} · {item.destinationName ?? "No destination"}
              </p>
              {lastCheckedAt || nextCheckAt ? (
                <p className="meta truncate">
                  {[
                    lastCheckedAt
                      ? `Last checked ${formatDateTime(lastCheckedAt)}`
                      : null,
                    nextCheckAt ? `Next ${formatDateTime(nextCheckAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button asChild size="sm" variant="ghost">
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
                aria-label={`Remove ${item.title}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onRemove(item);
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LibrarySkeleton = () => (
  <div className="panel rows">
    {Array.from({ length: 5 }).map((_, index) => (
      <div className="row" key={String(index)}>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);
