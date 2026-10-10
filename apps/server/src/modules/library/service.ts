import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  downloadDestinationColumns,
  downloadDestinationRow,
  libraryEntryColumns,
  libraryEntryRow,
  seriesColumns,
  seriesRow,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
} from "@mangy/db/model";
import { env } from "@mangy/env";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

const getTrackingPollIntervalMs = (): number => {
  const intervalMs = Number(env.TRACKING_POLL_INTERVAL_MS);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return 900_000;
  }

  return intervalMs;
};

const createEmptySeriesState = (sourceId: string, seriesId: string) => ({
  autoDownload: false,
  downloadDestinationId: null,
  downloadDestinationName: null,
  isTracked: false,
  libraryEntryId: null,
  seriesId,
  sourceId,
  trackingState: null,
});

const seriesStateProjection = Schema.Struct({
  autoDownload: Schema.NullOr(libraryEntryRow.fields.auto_download),
  checkFailureCount: Schema.NullOr(
    trackedSeriesStateRow.fields.check_failure_count
  ),
  downloadDestinationId: Schema.NullOr(downloadDestinationRow.fields.id),
  downloadDestinationName: Schema.NullOr(downloadDestinationRow.fields.name),
  isTracked: Schema.NullOr(libraryEntryRow.fields.is_tracked),
  lastCheckedAt: trackedSeriesStateRow.fields.last_checked_at,
  lastSeenChapterExternalId:
    trackedSeriesStateRow.fields.last_seen_chapter_external_id,
  libraryEntryId: Schema.NullOr(libraryEntryRow.fields.id),
  nextCheckAt: trackedSeriesStateRow.fields.next_check_at,
  seriesId: seriesRow.fields.external_id,
  sourceId: seriesRow.fields.source_id,
  trackingStateId: Schema.NullOr(trackedSeriesStateRow.fields.id),
});

type SeriesStateRow = Schema.Schema.Type<typeof seriesStateProjection>;

const serializeSeriesState = (row: SeriesStateRow) => ({
  libraryEntryId: row.libraryEntryId,
  sourceId: row.sourceId,
  seriesId: row.seriesId,
  isTracked: row.isTracked ?? false,
  autoDownload: row.autoDownload ?? false,
  downloadDestinationId: row.downloadDestinationId,
  downloadDestinationName: row.downloadDestinationName,
  trackingState: row.trackingStateId
    ? {
        id: row.trackingStateId,
        nextCheckAt: row.nextCheckAt ? row.nextCheckAt.toISOString() : null,
        lastCheckedAt: row.lastCheckedAt
          ? row.lastCheckedAt.toISOString()
          : null,
        lastSeenChapterExternalId: row.lastSeenChapterExternalId ?? null,
        checkFailureCount: row.checkFailureCount ?? 0,
      }
    : null,
});

const getSeriesStateRow = (
  userId: string,
  sourceId: string,
  seriesId: string
) =>
  Effect.gen(function* getSeriesStateRowEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      seriesStateProjection,
      yield* sql`SELECT ${table("libraryEntry")}.${column(libraryEntryColumns, "id")} AS ${sql("libraryEntryId")},
          ${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("sourceId")},
          ${table("series")}.${column(seriesColumns, "externalId")} AS ${sql("seriesId")},
          ${table("libraryEntry")}.${column(libraryEntryColumns, "isTracked")} AS ${sql("isTracked")},
          ${table("libraryEntry")}.${column(libraryEntryColumns, "autoDownload")} AS ${sql("autoDownload")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")} AS ${sql("downloadDestinationId")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "name")} AS ${sql("downloadDestinationName")},
          ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "id")} AS ${sql("trackingStateId")},
          ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "nextCheckAt")} AS ${sql("nextCheckAt")},
          ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "lastCheckedAt")} AS ${sql("lastCheckedAt")},
          ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "lastSeenChapterExternalId")} AS ${sql("lastSeenChapterExternalId")},
          ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "checkFailureCount")} AS ${sql("checkFailureCount")}
        FROM ${table("series")}
        LEFT JOIN ${table("libraryEntry")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")} AND ${table("libraryEntry")}.${column(libraryEntryColumns, "userId")} = ${userId}
        LEFT JOIN ${table("downloadDestination")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
        LEFT JOIN ${table("trackedSeriesState")} ON ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "libraryEntryId")} = ${table("libraryEntry")}.${column(libraryEntryColumns, "id")}
        WHERE ${table("series")}.${column(seriesColumns, "sourceId")} = ${sourceId}
          AND ${table("series")}.${column(seriesColumns, "externalId")} = ${seriesId}
        ORDER BY ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")} DESC
        LIMIT 1`
    );

    return rows[0] ?? null;
  });

const getSeriesState = (userId: string, sourceId: string, seriesId: string) =>
  Effect.gen(function* getSeriesStateEffect() {
    const row = yield* getSeriesStateRow(userId, sourceId, seriesId);

    if (!row) {
      return createEmptySeriesState(sourceId, seriesId);
    }

    return serializeSeriesState(row);
  });

const list = (userId: string) =>
  Effect.gen(function* listEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({
        id: libraryEntryRow.fields.id,
        source_id: seriesRow.fields.source_id,
        external_id: seriesRow.fields.external_id,
        title: seriesRow.fields.title,
        cover_image_url: Schema.NullOr(seriesRow.fields.cover_image_url),
        is_tracked: libraryEntryRow.fields.is_tracked,
        auto_download: libraryEntryRow.fields.auto_download,
        destination_name: Schema.NullOr(downloadDestinationRow.fields.name),
        updated_at: libraryEntryRow.fields.updated_at,
      }),
      yield* sql`SELECT ${table("libraryEntry")}.${column(libraryEntryColumns, "id")},
          ${table("series")}.${column(seriesColumns, "externalId")},
          ${table("series")}.${column(seriesColumns, "sourceId")},
          ${table("series")}.${column(seriesColumns, "title")},
          ${table("series")}.${column(seriesColumns, "coverImageUrl")},
          ${table("libraryEntry")}.${column(libraryEntryColumns, "isTracked")},
          ${table("libraryEntry")}.${column(libraryEntryColumns, "autoDownload")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "name")},
          ${table("libraryEntry")}.${column(libraryEntryColumns, "updatedAt")}
        FROM ${table("libraryEntry")}
        INNER JOIN ${table("series")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
        LEFT JOIN ${table("downloadDestination")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
        WHERE ${table("libraryEntry")}.${column(libraryEntryColumns, "userId")} = ${userId}
        ORDER BY ${table("libraryEntry")}.${column(libraryEntryColumns, "updatedAt")} DESC`
    );

    return rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      seriesId: row.external_id,
      title: row.title,
      coverImageUrl: row.cover_image_url,
      isTracked: row.is_tracked,
      autoDownload: row.auto_download,
      destinationName: row.destination_name ?? null,
      updatedAt: row.updated_at.toISOString(),
    }));
  });

const resolveSeriesRecord = (sourceId: string, seriesId: string) =>
  Effect.gen(function* resolveSeriesRecordEffect() {
    const existingRecord = yield* Effect.promise(() =>
      SourcesStorage.findSeriesRecord(sourceId, seriesId)
    );
    if (existingRecord) {
      return existingRecord;
    }

    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = yield* Effect.promise(() => adapter.getSeries(seriesId));

    return yield* Effect.promise(() =>
      SourcesStorage.upsertSeriesItem(sourceId, seriesItem)
    );
  });

const resolveDestinationId = (
  userId: string,
  requestedDestinationId: string | null | undefined,
  existingDestinationId: string | null
) =>
  Effect.gen(function* resolveDestinationIdEffect() {
    const sql = yield* SqlClient.SqlClient;
    const destinationId =
      requestedDestinationId === undefined
        ? existingDestinationId
        : requestedDestinationId;

    if (!destinationId) {
      return null;
    }

    const rows = yield* decodeRows(
      Schema.Struct({
        id: downloadDestinationRow.fields.id,
        is_enabled: downloadDestinationRow.fields.is_enabled,
      }),
      yield* sql`SELECT ${column(downloadDestinationColumns, "id")}, ${column(downloadDestinationColumns, "isEnabled")}
        FROM ${table("downloadDestination")}
        WHERE ${column(downloadDestinationColumns, "id")} = ${destinationId}
          AND ${column(downloadDestinationColumns, "userId")} = ${userId}
        LIMIT 1`
    );

    const [destination] = rows;
    if (!destination?.is_enabled) {
      throw new Error("The selected destination is missing or disabled.");
    }

    return destination.id;
  });

const upsertTrackedState = (input: {
  hadTrackingState: boolean;
  isAlreadyTracked: boolean;
  libraryEntryId: string;
  seriesExternalId: string;
  seriesRecordId: string;
  sourceId: string;
}) =>
  Effect.gen(function* upsertTrackedStateEffect() {
    const sql = yield* SqlClient.SqlClient;
    const currentRows = yield* decodeRows(
      Schema.Struct({
        id: trackedSeriesStateRow.fields.id,
        next_check_at: trackedSeriesStateRow.fields.next_check_at,
      }),
      yield* sql`SELECT ${column(trackedSeriesStateColumns, "id")}, ${column(trackedSeriesStateColumns, "nextCheckAt")}
        FROM ${table("trackedSeriesState")}
        WHERE ${column(trackedSeriesStateColumns, "libraryEntryId")} = ${input.libraryEntryId}
        ORDER BY ${column(trackedSeriesStateColumns, "updatedAt")} DESC`
    );
    const [primaryState, ...duplicateStates] = currentRows;
    const duplicateIds = duplicateStates.map((state) => state.id);

    if (!(input.isAlreadyTracked && input.hadTrackingState)) {
      const adapter = SourcesService.getSourceOrThrow(input.sourceId);
      const chapters = yield* Effect.promise(() =>
        adapter.getChapters(input.seriesExternalId)
      );
      yield* Effect.promise(() =>
        SourcesStorage.upsertChapters(input.seriesRecordId, chapters)
      );

      const now = new Date();
      const nextCheckAt = new Date(now.getTime() + getTrackingPollIntervalMs());

      if (primaryState) {
        yield* sql`UPDATE ${table("trackedSeriesState")} SET ${updateRow(
          sql,
          trackedSeriesStateColumns,
          {
            checkFailureCount: 0,
            lastCheckedAt: now,
            lastSeenChapterExternalId: chapters[0]?.externalId ?? null,
            nextCheckAt,
            updatedAt: now,
          }
        )}
          WHERE ${column(trackedSeriesStateColumns, "id")} = ${primaryState.id}`;
      } else {
        yield* sql`INSERT INTO ${table("trackedSeriesState")} ${insertRow(
          sql,
          trackedSeriesStateColumns,
          {
            id: crypto.randomUUID(),
            checkFailureCount: 0,
            lastCheckedAt: now,
            lastSeenChapterExternalId: chapters[0]?.externalId ?? null,
            libraryEntryId: input.libraryEntryId,
            nextCheckAt,
          }
        )}`;
      }

      if (duplicateIds.length > 0) {
        yield* sql`DELETE FROM ${table("trackedSeriesState")}
          WHERE ${column(trackedSeriesStateColumns, "id")} IN ${sql.in(duplicateIds)}`;
      }

      return;
    }

    if (duplicateIds.length > 0) {
      yield* sql`DELETE FROM ${table("trackedSeriesState")}
        WHERE ${column(trackedSeriesStateColumns, "id")} IN ${sql.in(duplicateIds)}`;
    }
  });

const updateSeriesState = (
  userId: string,
  input: {
    sourceId: string;
    seriesId: string;
    isTracked: boolean;
    autoDownload: boolean;
    downloadDestinationId?: string | null;
  }
) =>
  Effect.gen(function* updateSeriesStateEffect() {
    const sql = yield* SqlClient.SqlClient;
    const seriesRecord = yield* resolveSeriesRecord(
      input.sourceId,
      input.seriesId
    );
    const existingState = yield* getSeriesState(
      userId,
      input.sourceId,
      input.seriesId
    );

    const isTracked = input.isTracked || input.autoDownload;
    const downloadDestinationId = yield* resolveDestinationId(
      userId,
      input.downloadDestinationId,
      existingState.downloadDestinationId
    );

    if (input.autoDownload && !downloadDestinationId) {
      throw new Error("Choose a destination before enabling auto-download.");
    }

    const entries = yield* decodeRows(
      Schema.Struct({ id: libraryEntryRow.fields.id }),
      yield* sql`INSERT INTO ${table("libraryEntry")} ${insertRow(
        sql,
        libraryEntryColumns,
        {
          id: crypto.randomUUID(),
          autoDownload: input.autoDownload,
          downloadDestinationId,
          isTracked,
          seriesId: seriesRecord.id,
          userId,
        }
      )}
        ON CONFLICT (${column(libraryEntryColumns, "userId")}, ${column(libraryEntryColumns, "seriesId")}) DO UPDATE SET ${updateRow(
          sql,
          libraryEntryColumns,
          {
            autoDownload: input.autoDownload,
            downloadDestinationId,
            isTracked,
            updatedAt: new Date(),
          }
        )}
        RETURNING ${column(libraryEntryColumns, "id")}`
    );

    const [entry] = entries;
    if (!entry) {
      throw new Error("Unable to update the library entry for this series.");
    }

    if (isTracked) {
      yield* upsertTrackedState({
        hadTrackingState: Boolean(existingState.trackingState),
        isAlreadyTracked: existingState.isTracked,
        libraryEntryId: entry.id,
        seriesExternalId: input.seriesId,
        seriesRecordId: seriesRecord.id,
        sourceId: input.sourceId,
      });
    } else {
      yield* sql`DELETE FROM ${table("trackedSeriesState")}
        WHERE ${column(trackedSeriesStateColumns, "libraryEntryId")} = ${entry.id}`;
    }

    return yield* getSeriesState(userId, input.sourceId, input.seriesId);
  });

const removeSeries = (userId: string, sourceId: string, seriesId: string) =>
  Effect.gen(function* removeSeriesEffect() {
    const sql = yield* SqlClient.SqlClient;
    const row = yield* getSeriesStateRow(userId, sourceId, seriesId);

    if (!row?.libraryEntryId) {
      throw new Error("This series is not in your library.");
    }

    yield* sql`DELETE FROM ${table("libraryEntry")}
      WHERE ${column(libraryEntryColumns, "id")} = ${row.libraryEntryId}
        AND ${column(libraryEntryColumns, "userId")} = ${userId}`;

    return {
      sourceId,
      seriesId,
    };
  });

export const LibraryService = {
  async list(userId: string) {
    return await runSql(list(userId));
  },

  async getSeriesState(userId: string, sourceId: string, seriesId: string) {
    return await runSql(getSeriesState(userId, sourceId, seriesId));
  },

  async updateSeriesState(
    userId: string,
    input: {
      sourceId: string;
      seriesId: string;
      isTracked: boolean;
      autoDownload: boolean;
      downloadDestinationId?: string | null;
    }
  ) {
    return await runSql(updateSeriesState(userId, input));
  },

  async removeSeries(userId: string, sourceId: string, seriesId: string) {
    return await runSql(removeSeries(userId, sourceId, seriesId));
  },
};
