import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { chapterPages, seriesChapters, seriesDetail } from "@/atoms/series";
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
import {
  asyncResultError,
  asyncResultLoading,
  asyncResultValue,
} from "@/lib/async-result";
import { getErrorMessage, hasText, pluralize } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

const ReaderSkeleton = () => (
  <div className="flex flex-col items-center gap-2">
    <Skeleton className="h-[70vh] w-full max-w-4xl" />
    <Skeleton className="h-[70vh] w-full max-w-4xl" />
  </div>
);
const ReaderRouteComponent = () => {
  const { chapterId, seriesId, sourceId } = useParams({
    from: "/series/$sourceId/$seriesId/read/$chapterId",
  });
  const detailResult = useAtomValue(seriesDetail({ seriesId, sourceId }));
  const chaptersResult = useAtomValue(seriesChapters({ seriesId, sourceId }));
  const pagesResult = useAtomValue(
    chapterPages({ chapterId, seriesId, sourceId })
  );

  const series = asyncResultValue(detailResult);
  const chapters = asyncResultValue(chaptersResult) ?? [];
  const pages = asyncResultValue(pagesResult)?.pages ?? [];
  const error =
    asyncResultError(detailResult) ??
    asyncResultError(chaptersResult) ??
    asyncResultError(pagesResult);
  const isLoading =
    asyncResultLoading(detailResult) ||
    asyncResultLoading(chaptersResult) ||
    asyncResultLoading(pagesResult);

  const chapterIndex = chapters.findIndex(
    (chapter) => chapter.chapterId === chapterId
  );
  const chapter = chapterIndex === -1 ? null : chapters[chapterIndex];
  const newerChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const olderChapter =
    chapterIndex !== -1 && chapterIndex < chapters.length - 1
      ? chapters[chapterIndex + 1]
      : null;

  const chapterNumber = chapter?.chapterNumber ?? null;
  const chapterTitle = chapter?.title ?? null;
  const chapterLabel = hasText(chapterNumber)
    ? `Chapter ${chapterNumber}`
    : (chapterTitle ?? "Chapter reader");
  const pageCount = pages.length;
  const translatedLanguage = chapter?.translatedLanguage ?? null;
  const volumeNumber = chapter?.volumeNumber ?? null;

  const readerMeta = [
    series?.title,
    pageCount > 0 ? pluralize(pageCount, "page") : null,
    hasText(translatedLanguage) ? translatedLanguage.toUpperCase() : null,
    hasText(volumeNumber) ? `Volume ${volumeNumber}` : null,
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
          hasText(chapterTitle)
            ? `${chapterLabel}: ${chapterTitle}`
            : chapterLabel
        }
      />

      {isLoading ? <ReaderSkeleton /> : null}

      {error === undefined ? null : (
        <Alert variant="destructive">
          <AlertTitle>Unable to load this chapter</AlertTitle>
          <AlertDescription>
            {getErrorMessage(error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      )}

      {series && !isLoading && error === undefined ? (
        <div className="flex flex-col items-center gap-6">
          {pages.length > 0 ? (
            <div className="w-full max-w-4xl space-y-2">
              {pages.map((page) => (
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
};

export const Route = createFileRoute(
  "/series/$sourceId/$seriesId/read/$chapterId"
)({
  beforeLoad: requireAuth,
  component: ReaderRouteComponent,
});
