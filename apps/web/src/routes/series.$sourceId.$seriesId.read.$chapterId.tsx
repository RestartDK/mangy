import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useChapterPages } from "@/hooks/use-chapter-pages";
import { useSeriesDetail } from "@/hooks/use-series-detail";
import { getErrorMessage, pluralize } from "@/lib/format";
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
  const pageCount = pagesQuery.data?.length ?? 0;

  const readerMeta = [
    series?.title,
    pageCount ? pluralize(pageCount, "page") : null,
    chapter?.translatedLanguage
      ? chapter.translatedLanguage.toUpperCase()
      : null,
    chapter?.volumeNumber ? `Volume ${chapter.volumeNumber}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <AppShell>
      <PageHeader
        action={
          <div className="flex items-center gap-1">
            {newerChapter ? (
              <Button asChild size="sm" variant="ghost">
                <Link
                  params={{
                    chapterId: newerChapter.chapterId,
                    seriesId,
                    sourceId,
                  }}
                  to="/series/$sourceId/$seriesId/read/$chapterId"
                >
                  <ArrowLeft className="size-3.5" />
                  Newer
                </Link>
              </Button>
            ) : null}
            {olderChapter ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  params={{
                    chapterId: olderChapter.chapterId,
                    seriesId,
                    sourceId,
                  }}
                  to="/series/$sourceId/$seriesId/read/$chapterId"
                >
                  Older
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
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
        description={readerMeta.join(" · ")}
        title={
          chapter?.title ? `${chapterLabel}: ${chapter.title}` : chapterLabel
        }
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

      {series && !pagesQuery.isLoading && !pagesQuery.error ? (
        <div className="flex flex-col items-center gap-6">
          {pagesQuery.data?.length ? (
            <div className="w-full max-w-4xl space-y-2">
              {pagesQuery.data.map((page) => (
                <img
                  alt={`${series.title} ${chapterLabel} page ${page.index + 1}`}
                  className="bg-muted w-full"
                  decoding="async"
                  height={2400}
                  key={page.index}
                  loading="lazy"
                  src={page.imageUrl}
                  width={1600}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="w-full"
              description="This chapter returned no readable pages from the source."
              icon="library"
              title="No pages found"
            />
          )}

          <div className="flex w-full max-w-4xl items-center justify-between gap-3">
            <Button asChild size="lg" variant="outline">
              <Link
                params={{ seriesId, sourceId }}
                to="/series/$sourceId/$seriesId"
              >
                <ArrowLeft className="size-3.5" />
                Back to series
              </Link>
            </Button>
            {olderChapter ? (
              <Button asChild size="lg">
                <Link
                  params={{
                    chapterId: olderChapter.chapterId,
                    seriesId,
                    sourceId,
                  }}
                  to="/series/$sourceId/$seriesId/read/$chapterId"
                >
                  Next chapter
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

const ReaderSkeleton = () => (
  <div className="flex flex-col items-center gap-2">
    <Skeleton className="h-[70vh] w-full max-w-4xl" />
    <Skeleton className="h-[70vh] w-full max-w-4xl" />
  </div>
);
