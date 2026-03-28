import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/appShell";
import Loader from "@/components/loader";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEnqueueDownload } from "@/hooks/useEnqueueDownload";
import { useLibrarySeriesState } from "@/hooks/useLibrarySeriesState";
import { useRefreshTracking } from "@/hooks/useRefreshTracking";
import { useSeriesDetail } from "@/hooks/useSeriesDetail";
import { useSettingsBootstrap } from "@/hooks/useSettingsBootstrap";
import { useUpdateLibrarySeriesState } from "@/hooks/useUpdateLibrarySeriesState";
import { requireAuth } from "@/lib/requireAuth";
import { cn } from "@/lib/utils";

const getQueueReadinessLabel = (
  isUnavailable: boolean,
  hasDestination: boolean
): string => {
  if (isUnavailable) {
    return "This chapter is unavailable from the source right now.";
  }

  if (hasDestination) {
    return "Ready to queue";
  }

  return "Choose a destination to queue this chapter";
};

export const Route = createFileRoute("/series/$sourceId/$seriesId")({
  beforeLoad: requireAuth,
  component: SeriesDetailRouteComponent,
});

function SeriesDetailRouteComponent() {
  const { sourceId, seriesId } = Route.useParams();
  const { chapters, error, isLoading, series } = useSeriesDetail(
    sourceId,
    seriesId
  );
  const settingsQuery = useSettingsBootstrap();
  const libraryStateQuery = useLibrarySeriesState(sourceId, seriesId);
  const enqueueDownload = useEnqueueDownload();
  const updateLibrarySeriesState = useUpdateLibrarySeriesState();
  const refreshTracking = useRefreshTracking();
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [pendingChapterId, setPendingChapterId] = useState<string | null>(null);
  const [isTracked, setIsTracked] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);

  const enabledDestinations =
    settingsQuery.data?.destinations.filter(
      (destination) => destination.isEnabled
    ) ?? [];
  const trackingState = libraryStateQuery.data?.trackingState ?? null;
  const defaultDestinationId =
    enabledDestinations.find((destination) => destination.isDefault)?.id ??
    enabledDestinations[0]?.id ??
    "";

  const baselineDestinationId =
    libraryStateQuery.data?.downloadDestinationId ?? defaultDestinationId;
  const isTrackingDirty =
    isTracked !== (libraryStateQuery.data?.isTracked ?? false) ||
    autoDownload !== (libraryStateQuery.data?.autoDownload ?? false) ||
    selectedDestinationId !== baselineDestinationId;

  useEffect(() => {
    if (!libraryStateQuery.data) {
      return;
    }

    setIsTracked(libraryStateQuery.data.isTracked);
    setAutoDownload(libraryStateQuery.data.autoDownload);
    setSelectedDestinationId(
      libraryStateQuery.data.downloadDestinationId ?? defaultDestinationId
    );
  }, [defaultDestinationId, libraryStateQuery.data]);

  useEffect(() => {
    if (selectedDestinationId || enabledDestinations.length === 0) {
      return;
    }

    const defaultDestination =
      enabledDestinations.find((destination) => destination.isDefault) ??
      enabledDestinations[0];

    if (defaultDestination) {
      setSelectedDestinationId(defaultDestination.id);
    }
  }, [enabledDestinations, selectedDestinationId]);

  return (
    <AppShell
      subtitle="Series metadata, manual queueing, and tracked auto-download now feed the same durable worker pipeline and library state."
      title={series?.title ?? "Series details"}
    >
      {isLoading ? <Loader /> : null}

      {error ? (
        <PlaceholderPanel
          description="This series could not be loaded right now. Check the source adapter or try again in a moment."
          eyebrow="Series"
          title="Unable to load this title"
        />
      ) : null}

      {series ? (
        <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
          <section className="panelSurface p-6">
            <div className="aspect-[3/4] overflow-hidden rounded-[24px] bg-secondary/70">
              {series.coverImageUrl ? (
                <img
                  alt={series.title}
                  className="size-full object-cover"
                  height={960}
                  src={series.coverImageUrl}
                  width={720}
                />
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {series.tags.slice(0, 6).map((tag: string) => (
                <span
                  className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-muted-foreground text-xs uppercase tracking-[0.14em]"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-5 text-muted-foreground text-sm">
              {series.description || "No description available yet."}
            </p>
            <div className="mt-6 grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Download destination</span>
                <select
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  onChange={(event) =>
                    setSelectedDestinationId(event.target.value)
                  }
                  value={selectedDestinationId}
                >
                  {enabledDestinations.length > 0 ? null : (
                    <option value="">No enabled destinations</option>
                  )}
                  {enabledDestinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                      {destination.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {enabledDestinations.length > 0 ? (
                <div className="rounded-[20px] border border-border/60 bg-background/70 p-4 text-muted-foreground text-sm">
                  Jobs are picked up by the worker and written into the selected
                  Komga-ready folder even if the browser closes.
                </div>
              ) : (
                <PlaceholderPanel
                  description="Add a destination first so queued chapters have somewhere to land on disk."
                  eyebrow="Destination required"
                  title="Queueing needs a folder"
                >
                  <Link
                    className={cn(
                      buttonVariants({ size: "lg", variant: "outline" })
                    )}
                    to="/settings"
                  >
                    Configure destinations
                  </Link>
                </PlaceholderPanel>
              )}

              <div className="grid gap-3 rounded-[24px] border border-border/60 bg-background/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-base">
                      Tracking automation
                    </div>
                    <div className="mt-1 text-muted-foreground text-sm">
                      Watch this series for new chapters and optionally queue
                      them automatically.
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                    {trackingState ? "Tracked" : "Idle"}
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    checked={isTracked}
                    className="size-4 rounded border border-border"
                    onChange={(event) => {
                      const nextTracked = event.target.checked;
                      setIsTracked(nextTracked);
                      if (!nextTracked) {
                        setAutoDownload(false);
                      }
                    }}
                    type="checkbox"
                  />
                  <span>Track this series for release checks</span>
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    checked={autoDownload}
                    className="size-4 rounded border border-border"
                    disabled={!(isTracked && selectedDestinationId)}
                    onChange={(event) => setAutoDownload(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Automatically queue newly released chapters</span>
                </label>

                <div className="grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
                  <div>
                    Last checked:{" "}
                    {trackingState?.lastCheckedAt
                      ? new Date(trackingState.lastCheckedAt).toLocaleString()
                      : "Not checked yet"}
                  </div>
                  <div>
                    Next check:{" "}
                    {trackingState?.nextCheckAt
                      ? new Date(trackingState.nextCheckAt).toLocaleString()
                      : "Waiting for tracking to start"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      updateLibrarySeriesState.isPending ||
                      !libraryStateQuery.data ||
                      !isTrackingDirty ||
                      (autoDownload && !selectedDestinationId)
                    }
                    onClick={() => {
                      updateLibrarySeriesState
                        .mutateAsync({
                          autoDownload,
                          downloadDestinationId: selectedDestinationId || null,
                          isTracked,
                          seriesId,
                          sourceId,
                        })
                        .catch(() => undefined);
                    }}
                    size="lg"
                    type="button"
                  >
                    {updateLibrarySeriesState.isPending
                      ? "Saving..."
                      : "Save tracking"}
                  </Button>
                  <Button
                    disabled={!trackingState || refreshTracking.isPending}
                    onClick={() => {
                      refreshTracking
                        .mutateAsync({
                          seriesId,
                          sourceId,
                        })
                        .catch(() => undefined);
                    }}
                    size="lg"
                    type="button"
                    variant="outline"
                  >
                    {refreshTracking.isPending ? "Scheduling..." : "Check now"}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="panelSurface p-6">
            <div className="eyebrow">Chapter feed</div>
            <div className="mt-4 grid gap-3">
              {chapters.map((chapter) => (
                <article
                  className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                  key={chapter.chapterId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-base">
                        {chapter.chapterNumber
                          ? `Chapter ${chapter.chapterNumber}`
                          : "Special chapter"}
                        {chapter.title ? ` - ${chapter.title}` : ""}
                      </div>
                      <div className="mt-1 text-muted-foreground text-sm">
                        {chapter.publishedAt
                          ? new Date(chapter.publishedAt).toLocaleString()
                          : "Publish date unavailable"}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {chapter.pageCount
                        ? `${chapter.pageCount} pages`
                        : "Page count unavailable"}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-border/50 border-t pt-4">
                    <div className="text-muted-foreground text-sm">
                      {getQueueReadinessLabel(
                        chapter.isUnavailable,
                        Boolean(selectedDestinationId)
                      )}
                    </div>
                    <Button
                      disabled={
                        chapter.isUnavailable ||
                        !selectedDestinationId ||
                        enqueueDownload.isPending
                      }
                      onClick={() => {
                        setPendingChapterId(chapter.chapterId);
                        enqueueDownload
                          .mutateAsync({
                            chapterId: chapter.chapterId,
                            downloadDestinationId: selectedDestinationId,
                            seriesId,
                            sourceId,
                          })
                          .finally(() => {
                            setPendingChapterId((current) =>
                              current === chapter.chapterId ? null : current
                            );
                          })
                          .catch(() => undefined);
                      }}
                      size="lg"
                      type="button"
                    >
                      {pendingChapterId === chapter.chapterId
                        ? "Queueing..."
                        : "Queue chapter"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
