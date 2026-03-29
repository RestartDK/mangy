import type { SourceChapter, SourcePage } from "@mangy/source-sdk";

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

  if (page.referer && !headers.has("referer")) {
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
  if (value) {
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
  sourceId,
  seriesId: item.externalId,
  title: item.title,
  description: item.description,
  canonicalUrl: item.canonicalUrl,
  coverImageUrl: item.coverImageUrl,
  status: item.status,
  originalLanguage: item.originalLanguage,
  latestChapter: item.latestChapter,
  contentRating: item.contentRating,
  publicationDemographic: item.publicationDemographic,
  authorNames: item.authorNames,
  artistNames: item.artistNames,
  tags: item.tags,
  availableTranslatedLanguages: item.availableTranslatedLanguages,
});

const toChapterResponse = (item: SourceChapter) => ({
  chapterId: item.externalId,
  title: item.title,
  chapterNumber: item.chapterNumber,
  volumeNumber: item.volumeNumber,
  translatedLanguage: item.translatedLanguage,
  externalUrl: item.externalUrl,
  sourceOrder: item.sourceOrder,
  pageCount: item.pageCount,
  publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
  isUnavailable: item.isUnavailable,
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
  async getSeries(sourceId: string, seriesId: string) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = await adapter.getSeries(seriesId);
    await SourcesStorage.upsertSeriesItem(sourceId, seriesItem);
    return toSeriesResponse(sourceId, seriesItem);
  },

  async getChapters(sourceId: string, seriesId: string) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = await adapter.getSeries(seriesId);
    const seriesRecord = await SourcesStorage.upsertSeriesItem(
      sourceId,
      seriesItem
    );
    const chapters = await adapter.getChapters(seriesId);
    await SourcesStorage.upsertChapters(seriesRecord.id, chapters);
    return chapters.map(toChapterResponse);
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

    const seriesItem = await adapter.getSeries(seriesId);
    await SourcesStorage.upsertSeriesItem(sourceId, seriesItem);

    const pageList = await adapter.getPages(chapterId);

    return {
      pages: pageList.pages.map((item) =>
        toPageResponse(requestUrl, sourceId, seriesId, chapterId, item)
      ),
    };
  },

  async proxyPageImage(sourceId: string, chapterId: string, pageIndex: number) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);

    if (!adapter.metadata.capabilities.supportsPageFetch) {
      throw new SeriesServiceError(
        "This source does not support page fetching.",
        400
      );
    }

    const pageList = await adapter.getPages(chapterId);
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
