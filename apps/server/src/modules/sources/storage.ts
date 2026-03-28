import { db } from "@mangy/db";
import { chapter, series, source } from "@mangy/db/schema";
import type {
  SourceAdapter,
  SourceChapter,
  SourceSeries,
} from "@mangy/source-sdk";
import { and, eq } from "drizzle-orm";

const mapSeriesValues = (sourceId: string, item: SourceSeries) => ({
  sourceId,
  externalId: item.externalId,
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
  lastFetchedAt: new Date(),
});

const mapChapterValues = (seriesId: string, item: SourceChapter) => ({
  seriesId,
  externalId: item.externalId,
  title: item.title,
  chapterNumber: item.chapterNumber,
  volumeNumber: item.volumeNumber,
  translatedLanguage: item.translatedLanguage,
  externalUrl: item.externalUrl,
  sourceOrder: item.sourceOrder,
  pageCount: item.pageCount,
  publishedAt: item.publishedAt,
  isUnavailable: item.isUnavailable,
});

const mapSourceValues = (adapter: SourceAdapter) => ({
  id: adapter.metadata.id,
  name: adapter.metadata.name,
  description: adapter.metadata.description,
  websiteUrl: adapter.metadata.websiteUrl,
  iconUrl: adapter.metadata.iconUrl ?? null,
  languageCode: adapter.metadata.languageCode,
  supportedLanguages: adapter.metadata.supportedLanguages,
  isEnabled: true,
  supportsPopular: adapter.metadata.capabilities.supportsPopular,
  supportsLatest: adapter.metadata.capabilities.supportsLatest,
  supportsTrending: adapter.metadata.capabilities.supportsTrending,
  supportsSearch: adapter.metadata.capabilities.supportsSearch,
  supportsFilters: adapter.metadata.capabilities.supportsFilters,
  supportsSeriesDetails: adapter.metadata.capabilities.supportsSeriesDetails,
  supportsChapterFeed: adapter.metadata.capabilities.supportsChapterFeed,
  supportsPageFetch: adapter.metadata.capabilities.supportsPageFetch,
});

export class SourcesStorage {
  static async syncSources(adapters: SourceAdapter[]): Promise<void> {
    for (const adapter of adapters) {
      await db
        .insert(source)
        .values(mapSourceValues(adapter))
        .onConflictDoUpdate({
          target: source.id,
          set: {
            name: adapter.metadata.name,
            description: adapter.metadata.description,
            websiteUrl: adapter.metadata.websiteUrl,
            iconUrl: adapter.metadata.iconUrl ?? null,
            languageCode: adapter.metadata.languageCode,
            supportedLanguages: adapter.metadata.supportedLanguages,
            supportsPopular: adapter.metadata.capabilities.supportsPopular,
            supportsLatest: adapter.metadata.capabilities.supportsLatest,
            supportsTrending: adapter.metadata.capabilities.supportsTrending,
            supportsSearch: adapter.metadata.capabilities.supportsSearch,
            supportsFilters: adapter.metadata.capabilities.supportsFilters,
            supportsSeriesDetails:
              adapter.metadata.capabilities.supportsSeriesDetails,
            supportsChapterFeed:
              adapter.metadata.capabilities.supportsChapterFeed,
            supportsPageFetch: adapter.metadata.capabilities.supportsPageFetch,
            updatedAt: new Date(),
          },
        });
    }
  }

  static async upsertSeries(
    sourceId: string,
    items: SourceSeries[]
  ): Promise<void> {
    for (const item of items) {
      await SourcesStorage.upsertSeriesItem(sourceId, item);
    }
  }

  static async upsertSeriesItem(
    sourceId: string,
    item: SourceSeries
  ): Promise<{ id: string; sourceId: string; externalId: string }> {
    const [record] = await db
      .insert(series)
      .values(mapSeriesValues(sourceId, item))
      .onConflictDoUpdate({
        target: [series.sourceId, series.externalId],
        set: {
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
          lastFetchedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({
        id: series.id,
        sourceId: series.sourceId,
        externalId: series.externalId,
      });

    if (!record) {
      throw new Error("Failed to persist series record");
    }

    return record;
  }

  static async upsertChapters(
    seriesId: string,
    items: SourceChapter[]
  ): Promise<void> {
    for (const item of items) {
      await db
        .insert(chapter)
        .values(mapChapterValues(seriesId, item))
        .onConflictDoUpdate({
          target: [chapter.seriesId, chapter.externalId],
          set: {
            title: item.title,
            chapterNumber: item.chapterNumber,
            volumeNumber: item.volumeNumber,
            translatedLanguage: item.translatedLanguage,
            externalUrl: item.externalUrl,
            sourceOrder: item.sourceOrder,
            pageCount: item.pageCount,
            publishedAt: item.publishedAt,
            isUnavailable: item.isUnavailable,
            updatedAt: new Date(),
          },
        });
    }
  }

  static async findSeriesRecord(
    sourceId: string,
    externalId: string
  ): Promise<{ id: string } | null> {
    const [record] = await db
      .select({ id: series.id })
      .from(series)
      .where(
        and(eq(series.sourceId, sourceId), eq(series.externalId, externalId))
      );

    return record ?? null;
  }
}
