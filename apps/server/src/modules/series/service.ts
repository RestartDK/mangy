import type { SourceChapter } from "@mangy/source-sdk";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

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

export abstract class SeriesService {
  static async getSeries(sourceId: string, seriesId: string) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = await adapter.getSeries(seriesId);
    await SourcesStorage.upsertSeriesItem(sourceId, seriesItem);
    return toSeriesResponse(sourceId, seriesItem);
  }

  static async getChapters(sourceId: string, seriesId: string) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = await adapter.getSeries(seriesId);
    const seriesRecord = await SourcesStorage.upsertSeriesItem(
      sourceId,
      seriesItem
    );
    const chapters = await adapter.getChapters(seriesId);
    await SourcesStorage.upsertChapters(seriesRecord.id, chapters);
    return chapters.map(toChapterResponse);
  }
}
