import { runSql } from "@mangy/db";
import type { SourceChapter, SourcePage } from "@mangy/source-sdk";
import { Effect } from "effect";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

const proxiedPagePath = (
  sourceId: string,
  seriesId: string,
  chapterId: string,
  pageIndex: number
) =>
  `/api/series/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(chapterId)}/pages/${pageIndex}/image?sourceId=${encodeURIComponent(sourceId)}`;

const createPageRequestHeaders = (
  page: Pick<SourcePage, "headers" | "referer">
) => {
  const headers = new Headers(page.headers);

  if (
    page.referer !== undefined &&
    page.referer.length > 0 &&
    !headers.has("referer")
  ) {
    headers.set("referer", page.referer);
  }

  return headers;
};

const copyHeaderIfPresent = (
  sourceHeaders: Headers,
  targetHeaders: Headers,
  headerName: string
): void => {
  const value = sourceHeaders.get(headerName);
  if (value !== null && value.length > 0) {
    targetHeaders.set(headerName, value);
  }
};

export class SeriesServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SeriesServiceError";
    this.status = status;
  }
}

const toSeriesResponse = (
  sourceId: string,
  item: {
    externalId: string;
    title: string;
    description: string | null;
    canonicalUrl: string | null;
    coverImageUrl: string | null;
    status: "ongoing" | "completed" | "hiatus" | "cancelled" | "unknown";
    originalLanguage: string | null;
    latestChapter: string | null;
    contentRating: string | null;
    publicationDemographic: string | null;
    authorNames: string[];
    artistNames: string[];
    tags: string[];
    availableTranslatedLanguages: string[];
  }
) => ({
  artistNames: item.artistNames,
  authorNames: item.authorNames,
  availableTranslatedLanguages: item.availableTranslatedLanguages,
  canonicalUrl: item.canonicalUrl,
  contentRating: item.contentRating,
  coverImageUrl: item.coverImageUrl,
  description: item.description,
  latestChapter: item.latestChapter,
  originalLanguage: item.originalLanguage,
  publicationDemographic: item.publicationDemographic,
  seriesId: item.externalId,
  sourceId,
  status: item.status,
  tags: item.tags,
  title: item.title,
});

const toChapterResponse = (item: SourceChapter) => ({
  chapterId: item.externalId,
  chapterNumber: item.chapterNumber,
  externalUrl: item.externalUrl,
  isUnavailable: item.isUnavailable,
  pageCount: item.pageCount,
  publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
  sourceOrder: item.sourceOrder,
  title: item.title,
  translatedLanguage: item.translatedLanguage,
  volumeNumber: item.volumeNumber,
});

const toPageResponse = (
  requestUrl: string,
  sourceId: string,
  seriesId: string,
  chapterId: string,
  item: SourcePage
) => ({
  imageUrl: new URL(
    proxiedPagePath(sourceId, seriesId, chapterId, item.index),
    requestUrl
  ).toString(),
  index: item.index,
});

export const SeriesService = {
  async getChapters(sourceId: string, seriesId: string) {
    return await runSql(
      Effect.gen(function* getChaptersEffect() {
        const adapter = SourcesService.getSourceOrThrow(sourceId);
        const seriesItem = yield* adapter.getSeries(seriesId);
        const seriesRecord = yield* Effect.promise(
          async () =>
            await SourcesStorage.upsertSeriesItem(sourceId, seriesItem)
        );
        const chapters = yield* adapter.getChapters(seriesId);
        yield* Effect.promise(async () => {
          await SourcesStorage.upsertChapters(seriesRecord.id, chapters);
        });
        return chapters.map(toChapterResponse);
      })
    );
  },

  async getPages(
    sourceId: string,
    seriesId: string,
    chapterId: string,
    requestUrl: string
  ) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);

    if (!adapter.metadata.capabilities.supportsPageFetch) {
      throw new SeriesServiceError(
        "This source does not support page fetching.",
        400
      );
    }

    return await runSql(
      Effect.gen(function* getPagesEffect() {
        const seriesItem = yield* adapter.getSeries(seriesId);
        yield* Effect.promise(
          async () =>
            await SourcesStorage.upsertSeriesItem(sourceId, seriesItem)
        );
        const pageList = yield* adapter.getPages(chapterId);

        return {
          pages: pageList.pages.map((item) =>
            toPageResponse(requestUrl, sourceId, seriesId, chapterId, item)
          ),
        };
      })
    );
  },

  async getSeries(sourceId: string, seriesId: string) {
    return await runSql(
      Effect.gen(function* getSeriesEffect() {
        const adapter = SourcesService.getSourceOrThrow(sourceId);
        const seriesItem = yield* adapter.getSeries(seriesId);
        yield* Effect.promise(
          async () =>
            await SourcesStorage.upsertSeriesItem(sourceId, seriesItem)
        );
        return toSeriesResponse(sourceId, seriesItem);
      })
    );
  },

  async proxyPageImage(sourceId: string, chapterId: string, pageIndex: number) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);

    if (!adapter.metadata.capabilities.supportsPageFetch) {
      throw new SeriesServiceError(
        "This source does not support page fetching.",
        400
      );
    }

    const pageList = await runSql(adapter.getPages(chapterId));
    const page = pageList.pages.find((item) => item.index === pageIndex);

    if (!page) {
      throw new SeriesServiceError(
        "The requested page could not be found.",
        404
      );
    }

    const response = await fetch(page.imageUrl, {
      headers: createPageRequestHeaders(page),
    });

    if (!response.ok) {
      throw new SeriesServiceError(
        `Image proxy request failed with status ${response.status}.`,
        502
      );
    }

    const body = await response.arrayBuffer();
    const headers = new Headers();

    for (const headerName of [
      "cache-control",
      "content-length",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      copyHeaderIfPresent(response.headers, headers, headerName);
    }

    return new Response(body, {
      headers,
      status: 200,
    });
  },
};
