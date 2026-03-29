import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Layers3 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useChapterPages } from "@/hooks/use-chapter-pages";
import { useSeriesDetail } from "@/hooks/use-series-detail";
import { getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute(
  "/series/$sourceId/$seriesId/read/$chapterId"
)({
  beforeLoad: requireAuth,
  component: ReaderRouteComponent,
});

function ReaderRouteComponent() {
  const { chapterId, seriesId, sourceId } = Route.useParams();
  const {
    chapters,
    error: seriesError,
    isLoading: isSeriesLoading,
    series,
  } = useSeriesDetail(sourceId, seriesId);
  const pagesQuery = useChapterPages(sourceId, seriesId, chapterId);

  const chapterIndex = chapters.findIndex(
    (chapter) => chapter.chapterId === chapterId
  );
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;
  const newerChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const olderChapter =
    chapterIndex >= 0 && chapterIndex < chapters.length - 1
      ? chapters[chapterIndex + 1]
      : null;

  const chapterLabel = chapter?.chapterNumber
    ? `Chapter ${chapter.chapterNumber}`
    : (chapter?.title ?? "Chapter reader");

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
                <BreadcrumbLink asChild>
                  <Link
                    params={{ seriesId, sourceId }}
                    to="/series/$sourceId/$seriesId"
                  >
                    {series?.title ?? "Series"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{chapterLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        description="Read normalized, server-proxied pages without relying on fragile client-side hotlinks."
        title={chapterLabel}
      />

      {isSeriesLoading || pagesQuery.isLoading ? <ReaderSkeleton /> : null}

      {seriesError || pagesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load this chapter</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              seriesError ?? pagesQuery.error,
              "Try again in a moment."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {series && !pagesQuery.isLoading ? (
        <div className="page-grid">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="gap-3">
                <CardTitle className="flex flex-wrap items-center gap-3">
                  <span>
                    {chapter?.title
                      ? `${chapterLabel}: ${chapter.title}`
                      : chapterLabel}
                  </span>
                  <StatusBadge tone="secondary">
                    {pagesQuery.data?.length ?? 0} pages
                  </StatusBadge>
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {series.title}{" "}
                  {chapter?.translatedLanguage
                    ? `- ${chapter.translatedLanguage.toUpperCase()}`
                    : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {pagesQuery.data?.length ? (
                  <div className="space-y-5">
                    {pagesQuery.data.map((page) => (
                      <figure
                        className="overflow-hidden rounded-2xl border bg-linear-to-b from-muted/80 to-background shadow-sm"
                        key={page.index}
                      >
                        <img
                          alt={`${series.title} ${chapterLabel} page ${page.index + 1}`}
                          className="mx-auto w-full max-w-5xl"
                          decoding="async"
                          height={2400}
                          loading="lazy"
                          src={page.imageUrl}
                          width={1600}
                        />
                        <figcaption className="border-t px-4 py-2 text-center text-muted-foreground text-xs uppercase tracking-[0.2em]">
                          Page {page.index + 1}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description="This chapter returned no readable pages from the selected source."
                    icon="library"
                    title="No pages found"
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reader controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    asChild
                    className="w-full justify-between"
                    variant="outline"
                  >
                    <Link
                      params={{ seriesId, sourceId }}
                      to="/series/$sourceId/$seriesId"
                    >
                      Back to series
                      <BookOpen className="size-4" />
                    </Link>
                  </Button>

                  {newerChapter ? (
                    <Button
                      asChild
                      className="w-full justify-between"
                      variant="outline"
                    >
                      <Link
                        params={{
                          chapterId: newerChapter.chapterId,
                          seriesId,
                          sourceId,
                        }}
                        to="/series/$sourceId/$seriesId/read/$chapterId"
                      >
                        Newer chapter
                        <ArrowLeft className="size-4" />
                      </Link>
                    </Button>
                  ) : null}

                  {olderChapter ? (
                    <Button
                      asChild
                      className="w-full justify-between"
                      variant="outline"
                    >
                      <Link
                        params={{
                          chapterId: olderChapter.chapterId,
                          seriesId,
                          sourceId,
                        }}
                        to="/series/$sourceId/$seriesId/read/$chapterId"
                      >
                        Older chapter
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chapter info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ReaderMetaItem label="Series" value={series.title} />
                  <ReaderMetaItem label="Chapter" value={chapterLabel} />
                  <ReaderMetaItem
                    label="Pages"
                    value={String(pagesQuery.data?.length ?? 0)}
                  />
                  <ReaderMetaItem
                    label="Volume"
                    value={chapter?.volumeNumber ?? "Not available"}
                  />
                  <ReaderMetaItem
                    label="Order"
                    value={chapter?.sourceOrder ?? "Not available"}
                  />
                  <div className="rounded-xl border bg-muted/40 p-4 text-muted-foreground">
                    <div className="mb-2 inline-flex items-center gap-2 font-medium text-foreground text-xs uppercase tracking-[0.18em]">
                      <Layers3 className="size-3.5" />
                      Proxy reader
                    </div>
                    <p>
                      Every image is requested through the server page proxy so
                      source-specific headers and referers stay intact.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

const ReaderMetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border p-3">
    <div className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
      {label}
    </div>
    <div className="mt-1 font-medium">{value}</div>
  </div>
);

const ReaderSkeleton = () => (
  <div className="page-grid">
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardContent className="space-y-5 p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
