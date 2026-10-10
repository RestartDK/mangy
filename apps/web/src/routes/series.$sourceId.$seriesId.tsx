import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, RefreshCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeriesCover } from "@/components/series-cover";
import { SeriesMeta } from "@/components/series-meta";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useEnqueueDownload } from "@/hooks/use-enqueue-download";
import { useLibrarySeriesState } from "@/hooks/use-library-series-state";
import { useRefreshTracking } from "@/hooks/use-refresh-tracking";
import { useSeriesDetail } from "@/hooks/use-series-detail";
import { useSettingsBootstrap } from "@/hooks/use-settings-bootstrap";
import { useUpdateLibrarySeriesState } from "@/hooks/use-update-library-series-state";
import {
  formatDate,
  formatDateTime,
  getErrorMessage,
  pluralize,
} from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

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

    const destination =
      enabledDestinations.find((item) => item.isDefault) ??
      enabledDestinations[0];

    if (destination) {
      setSelectedDestinationId(destination.id);
    }
  }, [enabledDestinations, selectedDestinationId]);

  const canQueue = Boolean(selectedDestinationId);
  const canSaveTracking =
    Boolean(libraryStateQuery.data) &&
    isTrackingDirty &&
    !(autoDownload && !selectedDestinationId) &&
    !updateLibrarySeriesState.isPending;

  const metadata = [
    {
      label: "Author",
      value: series?.authorNames.length ? series.authorNames.join(", ") : null,
    },
    {
      label: "Artist",
      value: series?.artistNames.length ? series.artistNames.join(", ") : null,
    },
    {
      label: "Demographic",
      value: series?.publicationDemographic ?? null,
    },
    {
      label: "Languages",
      value: series?.availableTranslatedLanguages.length
        ? series.availableTranslatedLanguages.join(", ").toUpperCase()
        : null,
    },
  ].filter((item) => Boolean(item.value));

  return (
    <AppShell>
      <PageHeader
        action={
          series?.canonicalUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={series.canonicalUrl} rel="noopener" target="_blank">
                <ExternalLink className="size-3.5" />
                Open source
              </a>
            </Button>
          ) : null
        }
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/search">Search</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{series?.title ?? "Series"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={series?.title ?? "Series details"}
      />

      {isLoading ? <SeriesDetailSkeleton /> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load this series</AlertTitle>
          <AlertDescription>
            {getErrorMessage(error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {series ? (
        <div className="page-grid">
          <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
            <SeriesCover
              alt={series.title}
              className="aspect-2/3 w-40 rounded-xl lg:w-full"
              title={series.title}
              url={series.coverImageUrl}
            />
            <div className="min-w-0 space-y-5">
              <SeriesMeta
                contentRating={series.contentRating}
                language={series.originalLanguage}
                latestChapter={series.latestChapter}
                status={series.status}
              />
              <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
                {series.description ?? "No description available."}
              </p>
              {metadata.length ? (
                <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  {metadata.map((item) => (
                    <div className="min-w-0 space-y-1" key={item.label}>
                      <dt className="meta">{item.label}</dt>
                      <dd className="truncate text-sm">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {series.tags.length ? (
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  {series.tags.slice(0, 8).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <h2 className="panel-title">Chapters</h2>
                  {chapters.length ? (
                    <span className="meta">{chapters.length}</span>
                  ) : null}
                </div>
              </div>

              {chapters.length === 0 ? (
                <EmptyState
                  className="rounded-none border-0"
                  description="This source returned no chapters for the series."
                  icon="library"
                  title="No chapters found"
                />
              ) : (
                <div className="rows">
                  {chapters.map((chapter) => {
                    const chapterLabel = chapter.chapterNumber
                      ? `Chapter ${chapter.chapterNumber}`
                      : "Special chapter";
                    const isPending = pendingChapterId === chapter.chapterId;

                    return (
                      <div className="row" key={chapter.chapterId}>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="truncate text-sm font-medium">
                              {chapter.title
                                ? `${chapterLabel}: ${chapter.title}`
                                : chapterLabel}
                            </h3>
                            {chapter.isUnavailable ? (
                              <StatusBadge tone="danger">
                                Unavailable
                              </StatusBadge>
                            ) : null}
                          </div>
                          <p className="meta">
                            {[
                              formatDate(chapter.publishedAt),
                              chapter.pageCount
                                ? pluralize(chapter.pageCount, "page")
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {chapter.isUnavailable ? (
                            <Button
                              disabled
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <BookOpen className="size-3.5" />
                              Read
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="ghost">
                              <Link
                                params={{
                                  chapterId: chapter.chapterId,
                                  seriesId,
                                  sourceId,
                                }}
                                to="/series/$sourceId/$seriesId/read/$chapterId"
                              >
                                <BookOpen className="size-3.5" />
                                Read
                              </Link>
                            </Button>
                          )}
                          <Button
                            disabled={
                              chapter.isUnavailable ||
                              !canQueue ||
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
                                    current === chapter.chapterId
                                      ? null
                                      : current
                                  );
                                })
                                .catch(() => undefined);
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {isPending ? "Queueing..." : "Queue"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel h-fit">
              <div className="panel-header">
                <h2 className="panel-title">Manage</h2>
                {trackingState ? (
                  <StatusBadge tone="success">Tracking</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Not tracked</StatusBadge>
                )}
              </div>

              {settingsQuery.isLoading || libraryStateQuery.isLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              <div className="space-y-5 p-4">
                {!settingsQuery.isLoading &&
                enabledDestinations.length === 0 ? (
                  <Alert>
                    <AlertTitle>No destination</AlertTitle>
                    <AlertDescription>
                      Add a destination before queueing chapters.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="download-destination">
                    Destination
                  </FieldLabel>
                  <Select
                    onValueChange={setSelectedDestinationId}
                    value={selectedDestinationId || undefined}
                  >
                    <SelectTrigger
                      className="h-8 w-full"
                      id="download-destination"
                    >
                      <SelectValue placeholder="Choose a destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledDestinations.map((destination) => (
                        <SelectItem key={destination.id} value={destination.id}>
                          {destination.name}
                          {destination.isDefault ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="rows">
                  <Field
                    className="items-start gap-3 py-3"
                    orientation="horizontal"
                  >
                    <Switch
                      checked={isTracked}
                      onCheckedChange={(checked) => {
                        setIsTracked(checked);
                        if (!checked) {
                          setAutoDownload(false);
                        }
                      }}
                    />
                    <div className="space-y-0.5">
                      <FieldLabel>Track new chapters</FieldLabel>
                      <p className="meta">Check this series for releases.</p>
                    </div>
                  </Field>
                  <Field
                    className="items-start gap-3 py-3"
                    orientation="horizontal"
                  >
                    <Switch
                      checked={autoDownload}
                      disabled={!(isTracked && selectedDestinationId)}
                      onCheckedChange={setAutoDownload}
                    />
                    <div className="space-y-0.5">
                      <FieldLabel>Auto-queue releases</FieldLabel>
                      <p className="meta">Queue new chapters automatically.</p>
                    </div>
                  </Field>
                </div>

                {trackingState ? (
                  <dl className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="meta">Last checked</dt>
                      <dd className="text-xs">
                        {formatDateTime(trackingState.lastCheckedAt)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="meta">Next check</dt>
                      <dd className="text-xs">
                        {formatDateTime(trackingState.nextCheckAt)}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                <div className="grid gap-2">
                  <Button
                    disabled={!canSaveTracking}
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
                    type="button"
                  >
                    <Save className="size-3.5" />
                    {updateLibrarySeriesState.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    disabled={!trackingState || refreshTracking.isPending}
                    onClick={() => {
                      refreshTracking
                        .mutateAsync({ seriesId, sourceId })
                        .catch(() => undefined);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <RefreshCcw className="size-3.5" />
                    {refreshTracking.isPending
                      ? "Scheduling..."
                      : "Refresh tracking"}
                  </Button>
                  {enabledDestinations.length === 0 ? (
                    <Button asChild variant="ghost">
                      <Link to="/settings">Set up destinations</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

const SeriesDetailSkeleton = () => (
  <div className="page-grid">
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
      <Skeleton className="aspect-2/3 w-40 rounded-xl lg:w-full" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-10 w-full" key={String(index)} />
        ))}
      </div>
      <div className="panel space-y-3 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  </div>
);
