import { column, decodeRows, runSql, table, updateRow } from "@mangy/db";
import {
  libraryEntryColumns,
  seriesColumns,
  seriesRow,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
} from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

const trackedSeriesProjection = Schema.Struct({
  id: trackedSeriesStateRow.fields.id,
  sourceId: seriesRow.fields.source_id,
  seriesId: seriesRow.fields.external_id,
  title: seriesRow.fields.title,
  nextCheckAt: trackedSeriesStateRow.fields.next_check_at,
  lastCheckedAt: trackedSeriesStateRow.fields.last_checked_at,
  lastSeenChapterExternalId:
    trackedSeriesStateRow.fields.last_seen_chapter_external_id,
  checkFailureCount: trackedSeriesStateRow.fields.check_failure_count,
});

type TrackedSeries = Schema.Schema.Type<typeof trackedSeriesProjection>;

const serializeTrackedSeries = (row: TrackedSeries) => ({
  ...row,
  nextCheckAt: row.nextCheckAt ? row.nextCheckAt.toISOString() : null,
  lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
  lastSeenChapterExternalId: row.lastSeenChapterExternalId ?? null,
});

const baseQuery = (
  sql: SqlClient.SqlClient,
  userId: string,
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

const list = (userId: string) =>
  Effect.gen(function* listEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      trackedSeriesProjection,
      yield* sql`${baseQuery(sql, userId, [])}
        ORDER BY ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")} DESC`
    );

    return rows.map(serializeTrackedSeries);
  });

const requestRefresh = (userId: string, sourceId: string, seriesId: string) =>
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
      nextCheckAt: new Date().toISOString(),
      lastCheckedAt: trackedState.lastCheckedAt
        ? trackedState.lastCheckedAt.toISOString()
        : null,
      lastSeenChapterExternalId: trackedState.lastSeenChapterExternalId ?? null,
    };
  });

export const TrackingService = {
  async list(userId: string) {
    return await runSql(list(userId));
  },

  async requestRefresh(userId: string, sourceId: string, seriesId: string) {
    return await runSql(requestRefresh(userId, sourceId, seriesId));
  },
};
