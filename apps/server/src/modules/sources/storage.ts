import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  Series,
  chapterColumns,
  seriesColumns,
  sourceColumns,
} from "@mangy/db/model";
import type {
  SourceAdapter,
  SourceChapter,
  SourceSeries,
} from "@mangy/source-sdk";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

const mapSeriesValues = (sourceId: string, item: SourceSeries) => ({
  artistNames: item.artistNames,
  authorNames: item.authorNames,
  availableTranslatedLanguages: item.availableTranslatedLanguages,
  canonicalUrl: item.canonicalUrl,
  contentRating: item.contentRating,
  coverImageUrl: item.coverImageUrl,
  description: item.description,
  externalId: item.externalId,
  lastFetchedAt: new Date(),
  latestChapter: item.latestChapter,
  originalLanguage: item.originalLanguage,
  publicationDemographic: item.publicationDemographic,
  sourceId,
  status: item.status,
  tags: item.tags,
  title: item.title,
});

const mapChapterValues = (seriesId: string, item: SourceChapter) => ({
  chapterNumber: item.chapterNumber,
  externalId: item.externalId,
  externalUrl: item.externalUrl,
  isUnavailable: item.isUnavailable,
  pageCount: item.pageCount,
  publishedAt: item.publishedAt,
  seriesId,
  sourceOrder: item.sourceOrder,
  title: item.title,
  translatedLanguage: item.translatedLanguage,
  volumeNumber: item.volumeNumber,
});

const mapSourceValues = (adapter: SourceAdapter) => ({
  description: adapter.metadata.description,
  iconUrl: adapter.metadata.iconUrl ?? null,
  id: adapter.metadata.id,
  isEnabled: true,
  languageCode: adapter.metadata.languageCode,
  name: adapter.metadata.name,
  supportedLanguages: adapter.metadata.supportedLanguages,
  supportsChapterFeed: adapter.metadata.capabilities.supportsChapterFeed,
  supportsFilters: adapter.metadata.capabilities.supportsFilters,
  supportsLatest: adapter.metadata.capabilities.supportsLatest,
  supportsPageFetch: adapter.metadata.capabilities.supportsPageFetch,
  supportsPopular: adapter.metadata.capabilities.supportsPopular,
  supportsSearch: adapter.metadata.capabilities.supportsSearch,
  supportsSeriesDetails: adapter.metadata.capabilities.supportsSeriesDetails,
  supportsTrending: adapter.metadata.capabilities.supportsTrending,
  websiteUrl: adapter.metadata.websiteUrl,
});

const syncSource = (adapter: SourceAdapter) =>
  Effect.gen(function* syncSourceEffect() {
    const sql = yield* SqlClient.SqlClient;
    const values = mapSourceValues(adapter);

    yield* sql`INSERT INTO ${table("source")} ${insertRow(sql, sourceColumns, values)}
      ON CONFLICT (${column(sourceColumns, "id")}) DO UPDATE SET ${updateRow(
        sql,
        sourceColumns,
        {
          description: values.description,
          iconUrl: values.iconUrl,
          languageCode: values.languageCode,
          name: values.name,
          supportedLanguages: values.supportedLanguages,
          supportsChapterFeed: values.supportsChapterFeed,
          supportsFilters: values.supportsFilters,
          supportsLatest: values.supportsLatest,
          supportsPageFetch: values.supportsPageFetch,
          supportsPopular: values.supportsPopular,
          supportsSearch: values.supportsSearch,
          supportsSeriesDetails: values.supportsSeriesDetails,
          supportsTrending: values.supportsTrending,
          updatedAt: new Date(),
          websiteUrl: values.websiteUrl,
        }
      )}`;
  });

const upsertSeriesItem = (sourceId: string, item: SourceSeries) =>
  Effect.gen(function* upsertSeriesItemEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({
        external_id: Series.fields.externalId,
        id: Series.fields.id,
        source_id: Series.fields.sourceId,
      }),
      yield* sql`INSERT INTO ${table("series")} ${insertRow(
        sql,
        seriesColumns,
        {
          id: crypto.randomUUID(),
          ...mapSeriesValues(sourceId, item),
        }
      )}
        ON CONFLICT (${column(seriesColumns, "sourceId")}, ${column(seriesColumns, "externalId")}) DO UPDATE SET ${updateRow(
          sql,
          seriesColumns,
          {
            artistNames: item.artistNames,
            authorNames: item.authorNames,
            availableTranslatedLanguages: item.availableTranslatedLanguages,
            canonicalUrl: item.canonicalUrl,
            contentRating: item.contentRating,
            coverImageUrl: item.coverImageUrl,
            description: item.description,
            lastFetchedAt: new Date(),
            latestChapter: item.latestChapter,
            originalLanguage: item.originalLanguage,
            publicationDemographic: item.publicationDemographic,
            status: item.status,
            tags: item.tags,
            title: item.title,
            updatedAt: new Date(),
          }
        )}
        RETURNING ${column(seriesColumns, "id")}, ${column(seriesColumns, "sourceId")}, ${column(seriesColumns, "externalId")}`
    );

    const [record] = rows;
    if (!record) {
      throw new Error("Failed to persist series record");
    }

    return {
      externalId: record.external_id,
      id: record.id,
      sourceId: record.source_id,
    };
  });

const upsertChapters = (seriesId: string, items: SourceChapter[]) =>
  Effect.gen(function* upsertChaptersEffect() {
    const sql = yield* SqlClient.SqlClient;

    for (const item of items) {
      yield* sql`INSERT INTO ${table("chapter")} ${insertRow(
        sql,
        chapterColumns,
        {
          id: crypto.randomUUID(),
          ...mapChapterValues(seriesId, item),
        }
      )}
        ON CONFLICT (${column(chapterColumns, "seriesId")}, ${column(chapterColumns, "externalId")}) DO UPDATE SET ${updateRow(
          sql,
          chapterColumns,
          {
            chapterNumber: item.chapterNumber,
            externalUrl: item.externalUrl,
            isUnavailable: item.isUnavailable,
            pageCount: item.pageCount,
            publishedAt: item.publishedAt,
            sourceOrder: item.sourceOrder,
            title: item.title,
            translatedLanguage: item.translatedLanguage,
            updatedAt: new Date(),
            volumeNumber: item.volumeNumber,
          }
        )}`;
    }
  });

const findSeriesRecord = (sourceId: string, externalId: string) =>
  Effect.gen(function* findSeriesRecordEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({ id: Series.fields.id }),
      yield* sql`SELECT ${column(seriesColumns, "id")} FROM ${table("series")}
        WHERE ${column(seriesColumns, "sourceId")} = ${sourceId}
          AND ${column(seriesColumns, "externalId")} = ${externalId}`
    );

    return rows[0] ?? null;
  });

export const SourcesStorage = {
  async findSeriesRecord(
    sourceId: string,
    externalId: string
  ): Promise<{ id: string } | null> {
    return await runSql(findSeriesRecord(sourceId, externalId));
  },

  async syncSources(adapters: SourceAdapter[]): Promise<void> {
    for (const adapter of adapters) {
      await runSql(syncSource(adapter));
    }
  },

  async upsertChapters(
    seriesId: string,
    items: SourceChapter[]
  ): Promise<void> {
    await runSql(upsertChapters(seriesId, items));
  },

  async upsertSeries(sourceId: string, items: SourceSeries[]): Promise<void> {
    for (const item of items) {
      await SourcesStorage.upsertSeriesItem(sourceId, item);
    }
  },

  async upsertSeriesItem(
    sourceId: string,
    item: SourceSeries
  ): Promise<{ id: string; sourceId: string; externalId: string }> {
    return await runSql(upsertSeriesItem(sourceId, item));
  },
};
