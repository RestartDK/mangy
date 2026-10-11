import { column, decodeRows, runSql, table, updateRow } from "@mangy/db";
import {
  Series,
  SeriesIdSchema,
  TrackedSeriesState,
  libraryEntryColumns,
  seriesColumns,
  trackedSeriesStateColumns,
} from "@mangy/db/model";
import type { SeriesId, SourceId, UserId } from "@mangy/db/model";
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

const trackedSeriesProjection = Schema.Struct({
  checkFailureCount: TrackedSeriesState.fields.checkFailureCount,
  id: TrackedSeriesState.fields.id,
  lastCheckedAt: TrackedSeriesState.fields.lastCheckedAt,
  lastSeenChapterExternalId:
    TrackedSeriesState.fields.lastSeenChapterExternalId,
  nextCheckAt: TrackedSeriesState.fields.nextCheckAt,
  seriesId: SeriesIdSchema,
  sourceId: Series.fields.sourceId,
  title: Series.fields.title,
});

type TrackedSeries = Schema.Schema.Type<typeof trackedSeriesProjection>;

const serializeTrackedSeries = (row: TrackedSeries) => ({
  ...row,
  lastCheckedAt: row.lastCheckedAt.pipe(
    Option.map((value) => value.toISOString())
  ),
  lastSeenChapterExternalId: row.lastSeenChapterExternalId,
  nextCheckAt: row.nextCheckAt.pipe(Option.map((value) => value.toISOString())),
});

const baseQuery = (
  sql: SqlClient.SqlClient,
  userId: UserId,
  extra: readonly Fragment[]
) => sql`SELECT ${sql.csv([
  sql`${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "id")} AS ${sql("id")}`,
  sql`${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("sourceId")}`,
  sql`${table("series")}.${column(seriesColumns, "externalId")} AS ${sql("seriesId")}`,
  sql`${table("series")}.${column(seriesColumns, "title")} AS ${sql("title")}`,
  sql`${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "nextCheckAt")} AS ${sql("nextCheckAt")}`,
  sql`${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "lastCheckedAt")} AS ${sql("lastCheckedAt")}`,
  sql`${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "lastSeenChapterExternalId")} AS ${sql("lastSeenChapterExternalId")}`,
  sql`${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "checkFailureCount")} AS ${sql("checkFailureCount")}`,
])}
  FROM ${table("trackedSeriesState")}
  INNER JOIN ${table("libraryEntry")} ON ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "libraryEntryId")} = ${table("libraryEntry")}.${column(libraryEntryColumns, "id")}
  INNER JOIN ${table("series")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
  WHERE ${sql.and([
    sql`${table("libraryEntry")}.${column(libraryEntryColumns, "userId")} = ${userId}`,
    sql`${table("libraryEntry")}.${column(libraryEntryColumns, "isTracked")} = ${true}`,
    ...extra,
  ])}`;

const list = (userId: UserId) =>
  Effect.gen(function* listEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      trackedSeriesProjection,
      yield* sql`${baseQuery(sql, userId, [])}
        ORDER BY ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")} DESC`
    );

    return rows.map(serializeTrackedSeries);
  });

const requestRefresh = (
  userId: UserId,
  sourceId: SourceId,
  seriesId: SeriesId
) =>
  Effect.gen(function* requestRefreshEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      trackedSeriesProjection,
      yield* sql`${baseQuery(sql, userId, [
        sql`${table("series")}.${column(seriesColumns, "sourceId")} = ${sourceId}`,
        sql`${table("series")}.${column(seriesColumns, "externalId")} = ${seriesId}`,
      ])}
        ORDER BY ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")} DESC
        LIMIT 1`
    );

    const [trackedState] = rows;
    if (!trackedState) {
      throw new Error("Track this series before requesting a refresh.");
    }

    yield* sql`UPDATE ${table("trackedSeriesState")} SET ${updateRow(
      sql,
      trackedSeriesStateColumns,
      {
        nextCheckAt: new Date(),
        updatedAt: new Date(),
      }
    )}
      WHERE ${column(trackedSeriesStateColumns, "id")} = ${trackedState.id}`;

    return {
      ...trackedState,
      lastCheckedAt: trackedState.lastCheckedAt.pipe(
        Option.map((value) => value.toISOString())
      ),
      lastSeenChapterExternalId: trackedState.lastSeenChapterExternalId,
      nextCheckAt: Option.some(new Date().toISOString()),
    };
  });

export const TrackingService = {
  async list(userId: UserId) {
    return await runSql(list(userId));
  },

  async requestRefresh(userId: UserId, sourceId: SourceId, seriesId: SeriesId) {
    return await runSql(requestRefresh(userId, sourceId, seriesId));
  },
};
