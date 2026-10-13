import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { LibraryItem, TrackedSeries } from "@mangy/contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { reactivityKey } from "@/atoms/keys";
import { libraryQuery, removeLibrarySeries } from "@/atoms/library";
import { trackingQuery } from "@/atoms/tracking";
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
import { formatCause, formatDateTime } from "@/lib/format";
import { notifyMutation } from "@/lib/notify-mutation";
import { requireAuth } from "@/lib/require-auth";

type LibraryRouteItem = Pick<
  LibraryItem,
  | "autoDownload"
  | "destinationName"
  | "isTracked"
  | "seriesId"
  | "sourceId"
  | "title"
> & {
  trackingState: TrackedSeries | null;
};

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
        const lastCheckedAt =
          item.trackingState === null
            ? Option.none<string>()
            : item.trackingState.lastCheckedAt;
        const nextCheckAt =
          item.trackingState === null
            ? Option.none<string>()
            : item.trackingState.nextCheckAt;
        const state = [
          item.isTracked ? "Tracked" : "Saved",
          item.autoDownload ? "Auto-download on" : "Manual",
        ].join(" · ");

        return (
          <div className="row" key={`${item.sourceId}:${item.seriesId}`}>
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
                {Option.isSome(item.destinationName) ? null : (
                  <StatusBadge tone="warning">Needs destination</StatusBadge>
                )}
              </div>
              <p className="meta truncate">
                {state} ·{" "}
                {Option.getOrElse(item.destinationName, () => "No destination")}
              </p>
              {Option.isSome(lastCheckedAt) || Option.isSome(nextCheckAt) ? (
                <p className="meta truncate">
                  {[
                    Option.isSome(lastCheckedAt)
                      ? `Last checked ${formatDateTime(lastCheckedAt.value)}`
                      : null,
                    Option.isSome(nextCheckAt)
                      ? `Next ${formatDateTime(nextCheckAt.value)}`
                      : null,
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
const LibraryRouteComponent = () => {
  const library = useAtomValue(libraryQuery);
  const tracking = useAtomValue(trackingQuery);
  const removeSeries = useAtomSet(removeLibrarySeries, { mode: "promise" });
  const removeResult = useAtomValue(removeLibrarySeries);
  const isRemoving = AsyncResult.isWaiting(removeResult);
  const [seriesPendingRemoval, setSeriesPendingRemoval] =
    useState<LibraryRouteItem | null>(null);

  const trackingItems = Option.getOrElse(AsyncResult.value(tracking), () => []);
  const error = Option.orElse(AsyncResult.cause(library), () =>
    AsyncResult.cause(tracking)
  );
  const isLoading =
    AsyncResult.isInitial(library) || AsyncResult.isInitial(tracking);

  const trackingMap = new Map(
    trackingItems.map((item) => [`${item.sourceId}:${item.seriesId}`, item])
  );

  const libraryItems = Option.getOrElse(
    AsyncResult.value(library),
    () => []
  ).map((item) => ({
    ...item,
    trackingState: trackingMap.get(`${item.sourceId}:${item.seriesId}`) ?? null,
  }));

  const trackingOnlyItems = trackingItems
    .filter(
      (item) =>
        !libraryItems.some(
          (entry) =>
            entry.sourceId === item.sourceId && entry.seriesId === item.seriesId
        )
    )
    .map((item) => ({
      autoDownload: false,
      coverImageUrl: Option.none<string>(),
      destinationName: Option.none<string>(),
      isTracked: true,
      seriesId: item.seriesId,
      sourceId: item.sourceId,
      title: item.title,
      trackingState: item,
    }));

  const items: LibraryRouteItem[] = [...libraryItems, ...trackingOnlyItems];
  const trackedItems = items.filter((item) => item.isTracked);
  const autoDownloadItems = items.filter((item) => item.autoDownload);
  const needsDestinationItems = items.filter((item) =>
    Option.isNone(item.destinationName)
  );

  const removePendingSeries = async (item: LibraryRouteItem): Promise<void> => {
    const removed = await notifyMutation(
      removeSeries({
        query: { seriesId: item.seriesId, sourceId: item.sourceId },
        reactivityKeys: [
          reactivityKey.library,
          reactivityKey.tracking,
          reactivityKey.librarySeriesState,
        ],
      }),
      {
        failure: "Unable to remove series from library",
        success: "Series removed from library",
      }
    );

    if (removed) {
      setSeriesPendingRemoval(null);
    }
  };

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

      {Option.isSome(error) ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the library</AlertTitle>
          <AlertDescription>
            {formatCause(error.value, "Try again in a moment.")}
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
                if (seriesPendingRemoval === null) {
                  return;
                }

                void removePendingSeries(seriesPendingRemoval);
              }}
              type="button"
              variant="destructive"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
            <Button
              disabled={isRemoving}
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
};

export const Route = createFileRoute("/library")({
  beforeLoad: requireAuth,
  component: LibraryRouteComponent,
});
