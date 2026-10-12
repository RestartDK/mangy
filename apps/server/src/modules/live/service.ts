import type { LiveSnapshot } from "@mangy/contract";
import { column, decodeRows, runSql, table } from "@mangy/db";
import {
  DownloadJob,
  Notification,
  TrackedSeriesState,
  downloadJobColumns,
  libraryEntryColumns,
  notificationColumns,
  trackedSeriesStateColumns,
} from "@mangy/db/model";
import type { UserId } from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql";

const getSnapshot = (
  userId: UserId
): Effect.Effect<
  LiveSnapshot,
  Schema.SchemaError | SqlError.SqlError,
  SqlClient.SqlClient
> =>
  Effect.gen(function* getSnapshotEffect() {
    const sql = yield* SqlClient.SqlClient;
    const [downloadRecord, notificationRecord, unreadRecord, trackingRecord] =
      yield* Effect.all(
        [
          Effect.gen(function* downloads() {
            const rows = yield* decodeRows(
              Schema.Struct({
                updated_at: DownloadJob.fields.updatedAt,
              }),
              yield* sql`SELECT ${column(downloadJobColumns, "updatedAt")} FROM ${table("downloadJob")}
                WHERE ${column(downloadJobColumns, "userId")} = ${userId}
                ORDER BY ${column(downloadJobColumns, "updatedAt")} DESC
                LIMIT 1`
            );

            return rows[0] ?? null;
          }),
          Effect.gen(function* notifications() {
            const rows = yield* decodeRows(
              Schema.Struct({ updated_at: Notification.fields.updatedAt }),
              yield* sql`SELECT ${column(notificationColumns, "updatedAt")} FROM ${table("notification")}
                WHERE ${column(notificationColumns, "userId")} = ${userId}
                ORDER BY ${column(notificationColumns, "updatedAt")} DESC
                LIMIT 1`
            );

            return rows[0] ?? null;
          }),
          Effect.gen(function* unread() {
            const rows = yield* decodeRows(
              Schema.Struct({ id: Notification.fields.id }),
              yield* sql`SELECT ${column(notificationColumns, "id")} FROM ${table("notification")}
                WHERE ${column(notificationColumns, "userId")} = ${userId}
                  AND ${column(notificationColumns, "isRead")} = ${false}`
            );

            return rows.length;
          }),
          Effect.gen(function* tracking() {
            const rows = yield* decodeRows(
              Schema.Struct({
                updated_at: TrackedSeriesState.fields.updatedAt,
              }),
              yield* sql`SELECT ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")}
                FROM ${table("trackedSeriesState")}
                INNER JOIN ${table("libraryEntry")} ON ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "libraryEntryId")} = ${table("libraryEntry")}.${column(libraryEntryColumns, "id")}
                WHERE ${table("libraryEntry")}.${column(libraryEntryColumns, "userId")} = ${userId}
                ORDER BY ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "updatedAt")} DESC
                LIMIT 1`
            );

            return rows[0] ?? null;
          }),
        ],
        { concurrency: "unbounded" }
      );

    return {
      downloadsUpdatedAt: downloadRecord?.updated_at?.toISOString() ?? null,
      notificationsUnreadCount: unreadRecord,
      notificationsUpdatedAt:
        notificationRecord?.updated_at?.toISOString() ?? null,
      trackingUpdatedAt: trackingRecord?.updated_at?.toISOString() ?? null,
    };
  });

export const LiveService = {
  async loadSnapshot(userId: UserId) {
    return await runSql(getSnapshot(userId));
  },
};

export const hasSnapshotChanged = (
  left: LiveSnapshot,
  right: LiveSnapshot
): boolean =>
  left.downloadsUpdatedAt !== right.downloadsUpdatedAt ||
  left.notificationsUpdatedAt !== right.notificationsUpdatedAt ||
  left.notificationsUnreadCount !== right.notificationsUnreadCount ||
  left.trackingUpdatedAt !== right.trackingUpdatedAt;
