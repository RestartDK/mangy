import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, RefreshCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ChapterListItem } from "@/components/chapter-list-item";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEnqueueDownload } from "@/hooks/use-enqueue-download";
import { useLibrarySeriesState } from "@/hooks/use-library-series-state";
import { useRefreshTracking } from "@/hooks/use-refresh-tracking";
import { useSeriesDetail } from "@/hooks/use-series-detail";
import { useSettingsBootstrap } from "@/hooks/use-settings-bootstrap";
import { useUpdateLibrarySeriesState } from "@/hooks/use-update-library-series-state";
import { formatDate, formatDateTime, getErrorMessage } from "@/lib/format";
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

  return (
    <AppShell>
      <PageHeader
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
        description="Review the series, choose how you want it managed, and queue the chapters you want next."
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardContent className="grid gap-6 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
                <div className="overflow-hidden rounded-lg border bg-muted">
                  {series.coverImageUrl ? (
                    <img
                      alt={series.title}
                      className="aspect-[3/4] size-full object-cover"
                      height={960}
                      src={series.coverImageUrl}
                      width={720}
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center px-6 text-center font-heading text-lg text-muted-foreground">
                      {series.title}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <SeriesMeta
                    contentRating={series.contentRating}
                    language={series.originalLanguage}
                    latestChapter={series.latestChapter}
                    status={series.status}
                  />
                  <p className="text-muted-foreground text-sm">
                    {series.description ??
                      "No description is available for this series yet."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetadataItem
                      label="Author"
                      value={
                        series.authorNames.length
                          ? series.authorNames.join(", ")
                          : "Not available"
                      }
                    />
                    <MetadataItem
                      label="Artist"
                      value={
                        series.artistNames.length
                          ? series.artistNames.join(", ")
                          : "Not available"
                      }
                    />
                    <MetadataItem
                      label="Demographic"
                      value={series.publicationDemographic ?? "Not available"}
                    />
                    <MetadataItem
                      label="Languages"
                      value={
                        series.availableTranslatedLanguages.length
                          ? series.availableTranslatedLanguages.join(", ")
                          : "Not available"
                      }
                    />
                  </div>
                  {series.tags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {series.tags.slice(0, 8).map((tag) => (
                        <StatusBadge key={tag} tone="secondary">
                          {tag}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manage this series</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Choose where downloads go and whether new chapters should be
                  tracked.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {settingsQuery.isLoading || libraryStateQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : null}

                {!settingsQuery.isLoading &&
                enabledDestinations.length === 0 ? (
                  <Alert>
                    <AlertTitle>No download destination</AlertTitle>
                    <AlertDescription>
                      Add an enabled destination before you queue chapters or
                      turn on auto-queue.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="download-destination">
                    Download destination
                  </FieldLabel>
                  <Select
                    onValueChange={setSelectedDestinationId}
                    value={selectedDestinationId || undefined}
                  >
                    <SelectTrigger className="w-full" id="download-destination">
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
                  <FieldDescription>
                    Pick the folder where queued chapters should be saved.
                  </FieldDescription>
                </Field>

                <Field
                  className="rounded-lg border p-4"
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
                  <div className="space-y-1">
                    <FieldLabel>Track for new chapters</FieldLabel>
                    <FieldDescription>
                      Keep checking this series so new releases show up in your
                      workflow.
                    </FieldDescription>
                  </div>
                </Field>

                <Field
                  className="rounded-lg border p-4"
                  orientation="horizontal"
                >
                  <Switch
                    checked={autoDownload}
                    disabled={!(isTracked && selectedDestinationId)}
                    onCheckedChange={setAutoDownload}
                  />
                  <div className="space-y-1">
                    <FieldLabel>Auto-queue new releases</FieldLabel>
                    <FieldDescription>
                      Automatically add new chapters to the queue when tracking
                      finds them.
                    </FieldDescription>
                  </div>
                </Field>

                <div className="grid gap-3 rounded-lg border p-4 text-muted-foreground text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Tracking status</span>
                    <StatusBadge tone={trackingState ? "secondary" : "outline"}>
                      {trackingState ? "Tracking active" : "Not tracking"}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Last checked</span>
                    <span>{formatDateTime(trackingState?.lastCheckedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Next check</span>
                    <span>{formatDateTime(trackingState?.nextCheckAt)}</span>
                  </div>
                </div>

                {enabledDestinations.length === 0 ? (
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/settings">Set up destinations</Link>
                  </Button>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
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
                    <Save className="size-4" />
                    {updateLibrarySeriesState.isPending
                      ? "Saving..."
                      : "Save changes"}
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
                    <RefreshCcw className="size-4" />
                    {refreshTracking.isPending
                      ? "Scheduling..."
                      : "Refresh tracking"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chapters</CardTitle>
              <p className="text-muted-foreground text-sm">
                Queue chapters one by one after choosing a download destination.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {chapters.length ? null : (
                <EmptyState
                  description="No chapters are available for this series right now."
                  icon="library"
                  title="No chapters found"
                />
              )}

              {chapters.length ? (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Chapter</TableHead>
                          <TableHead>Published</TableHead>
                          <TableHead>Pages</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chapters.map((chapter) => {
                          const chapterLabel = chapter.chapterNumber
                            ? `Chapter ${chapter.chapterNumber}`
                            : "Special chapter";

                          return (
                            <TableRow key={chapter.chapterId}>
                              <TableCell className="min-w-0">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {chapter.title
                                      ? `${chapterLabel}: ${chapter.title}`
                                      : chapterLabel}
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {canQueue
                                      ? "Ready to queue"
                                      : "Choose a destination before queueing"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatDate(chapter.publishedAt)}
                              </TableCell>
                              <TableCell>
                                {chapter.pageCount
                                  ? `${chapter.pageCount} pages`
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  tone={
                                    chapter.isUnavailable
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {chapter.isUnavailable
                                    ? "Unavailable"
                                    : "Ready"}
                                </StatusBadge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {chapter.isUnavailable ? (
                                    <Button
                                      disabled
                                      type="button"
                                      variant="outline"
                                    >
                                      <BookOpen className="size-4" />
                                      Read
                                    </Button>
                                  ) : (
                                    <Button
                                      asChild
                                      type="button"
                                      variant="outline"
                                    >
                                      <Link
                                        params={{
                                          chapterId: chapter.chapterId,
                                          seriesId,
                                          sourceId,
                                        }}
                                        to="/series/$sourceId/$seriesId/read/$chapterId"
                                      >
                                        <BookOpen className="size-4" />
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
                                          downloadDestinationId:
                                            selectedDestinationId,
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
                                    type="button"
                                  >
                                    {pendingChapterId === chapter.chapterId
                                      ? "Queueing..."
                                      : "Queue"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-4 md:hidden">
                    {chapters.map((chapter) => (
                      <ChapterListItem
                        canQueue={canQueue}
                        chapter={chapter}
                        isPending={pendingChapterId === chapter.chapterId}
                        key={chapter.chapterId}
                        onQueue={(chapterId) => {
                          setPendingChapterId(chapterId);
                          enqueueDownload
                            .mutateAsync({
                              chapterId,
                              downloadDestinationId: selectedDestinationId,
                              seriesId,
                              sourceId,
                            })
                            .finally(() => {
                              setPendingChapterId((current) =>
                                current === chapterId ? null : current
                              );
                            })
                            .catch(() => undefined);
                        }}
                        seriesId={seriesId}
                        sourceId={sourceId}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}

const MetadataItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
};

const SeriesDetailSkeleton = () => {
  return (
    <div className="page-grid">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardContent className="grid gap-6 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
            <Skeleton className="aspect-[3/4] w-full" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={String(index)} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
