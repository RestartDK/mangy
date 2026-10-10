import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  chapterColumns,
  seriesColumns,
  seriesRow,
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

const syncSource = (adapter: SourceAdapter) =>
  Effect.gen(function* syncSourceEffect() {
    const sql = yield* SqlClient.SqlClient;
    const values = mapSourceValues(adapter);

    yield* sql`INSERT INTO ${table("source")} ${insertRow(sql, sourceColumns, values)}
      ON CONFLICT (${column(sourceColumns, "id")}) DO UPDATE SET ${updateRow(
        sql,
        sourceColumns,
        {
          name: values.name,
          description: values.description,
          websiteUrl: values.websiteUrl,
          iconUrl: values.iconUrl,
          languageCode: values.languageCode,
          supportedLanguages: values.supportedLanguages,
          supportsPopular: values.supportsPopular,
          supportsLatest: values.supportsLatest,
          supportsTrending: values.supportsTrending,
          supportsSearch: values.supportsSearch,
          supportsFilters: values.supportsFilters,
          supportsSeriesDetails: values.supportsSeriesDetails,
          supportsChapterFeed: values.supportsChapterFeed,
          supportsPageFetch: values.supportsPageFetch,
          updatedAt: new Date(),
        }
      )}`;
  });

const upsertSeriesItem = (sourceId: string, item: SourceSeries) =>
  Effect.gen(function* upsertSeriesItemEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({
        id: seriesRow.fields.id,
        source_id: seriesRow.fields.source_id,
        external_id: seriesRow.fields.external_id,
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
          }
        )}
        RETURNING ${column(seriesColumns, "id")}, ${column(seriesColumns, "sourceId")}, ${column(seriesColumns, "externalId")}`
    );

    const [record] = rows;
    if (!record) {
      throw new Error("Failed to persist series record");
    }

    return {
      id: record.id,
      sourceId: record.source_id,
      externalId: record.external_id,
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
          }
        )}`;
    }
  });

const findSeriesRecord = (sourceId: string, externalId: string) =>
  Effect.gen(function* findSeriesRecordEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({ id: seriesRow.fields.id }),
      yield* sql`SELECT ${column(seriesColumns, "id")} FROM ${table("series")}
        WHERE ${column(seriesColumns, "sourceId")} = ${sourceId}
          AND ${column(seriesColumns, "externalId")} = ${externalId}`
    );

    return rows[0] ?? null;
  });

export const SourcesStorage = {
  async syncSources(adapters: SourceAdapter[]): Promise<void> {
    for (const adapter of adapters) {
      await runSql(syncSource(adapter));
    }
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

  async upsertChapters(
    seriesId: string,
    items: SourceChapter[]
  ): Promise<void> {
    await runSql(upsertChapters(seriesId, items));
  },

  async findSeriesRecord(
    sourceId: string,
    externalId: string
  ): Promise<{ id: string } | null> {
    return await runSql(findSeriesRecord(sourceId, externalId));
  },
};
