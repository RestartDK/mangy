import { column, decodeRows, runSql, table } from "@mangy/db";
import {
  downloadJobColumns,
  downloadJobRow,
  libraryEntryColumns,
  notificationColumns,
  notificationRow,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
} from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Elysia } from "elysia";

import { getSessionUser } from "@/lib/auth";

interface LiveSnapshot {
  downloadsUpdatedAt: string | null;
  notificationsUpdatedAt: string | null;
  notificationsUnreadCount: number;
  trackingUpdatedAt: string | null;
}

const getSnapshot = (
  userId: string
): Effect.Effect<LiveSnapshot, unknown, SqlClient.SqlClient> =>
  Effect.gen(function* getSnapshotEffect() {
    const sql = yield* SqlClient.SqlClient;
    const [downloadRecord, notificationRecord, unreadRecord, trackingRecord] =
      yield* Effect.all(
        [
          Effect.gen(function* downloads() {
            const rows = yield* decodeRows(
              Schema.Struct({
                updated_at: downloadJobRow.fields.updated_at,
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
              Schema.Struct({ updated_at: notificationRow.fields.updated_at }),
              yield* sql`SELECT ${column(notificationColumns, "updatedAt")} FROM ${table("notification")}
                WHERE ${column(notificationColumns, "userId")} = ${userId}
                ORDER BY ${column(notificationColumns, "updatedAt")} DESC
                LIMIT 1`
            );

            return rows[0] ?? null;
          }),
          Effect.gen(function* unread() {
            const rows = yield* decodeRows(
              Schema.Struct({ id: notificationRow.fields.id }),
              yield* sql`SELECT ${column(notificationColumns, "id")} FROM ${table("notification")}
                WHERE ${column(notificationColumns, "userId")} = ${userId}
                  AND ${column(notificationColumns, "isRead")} = ${false}`
            );

            return rows.length;
          }),
          Effect.gen(function* tracking() {
            const rows = yield* decodeRows(
              Schema.Struct({
                updated_at: trackedSeriesStateRow.fields.updated_at,
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
      notificationsUpdatedAt:
        notificationRecord?.updated_at?.toISOString() ?? null,
      notificationsUnreadCount: unreadRecord,
      trackingUpdatedAt: trackingRecord?.updated_at?.toISOString() ?? null,
    };
  });

const loadSnapshot = (userId: string) => runSql(getSnapshot(userId));

const hasSnapshotChanged = (left: LiveSnapshot, right: LiveSnapshot): boolean =>
  left.downloadsUpdatedAt !== right.downloadsUpdatedAt ||
  left.notificationsUpdatedAt !== right.notificationsUpdatedAt ||
  left.notificationsUnreadCount !== right.notificationsUnreadCount ||
  left.trackingUpdatedAt !== right.trackingUpdatedAt;

const formatSseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const live = new Elysia({ prefix: "/api/live" }).get(
  "/events",
  async ({ request, set }) => {
    const user = await getSessionUser(request);
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    const encoder = new TextEncoder();
    const initialSnapshot = await loadSnapshot(user.id);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let lastSnapshot = initialSnapshot;
        let isClosed = false;
        let isPolling = false;

        const send = (event: string, data: unknown) => {
          if (isClosed) {
            return;
          }

          controller.enqueue(encoder.encode(formatSseEvent(event, data)));
        };

        const cleanup = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        };

        const poll = async () => {
          if (isClosed || isPolling) {
            return;
          }

          isPolling = true;

          try {
            const nextSnapshot = await loadSnapshot(user.id);
            if (hasSnapshotChanged(lastSnapshot, nextSnapshot)) {
              send("state", {
                downloadsChanged:
                  nextSnapshot.downloadsUpdatedAt !==
                  lastSnapshot.downloadsUpdatedAt,
                notificationsChanged:
                  nextSnapshot.notificationsUpdatedAt !==
                    lastSnapshot.notificationsUpdatedAt ||
                  nextSnapshot.notificationsUnreadCount !==
                    lastSnapshot.notificationsUnreadCount,
                snapshot: nextSnapshot,
                trackingChanged:
                  nextSnapshot.trackingUpdatedAt !==
                  lastSnapshot.trackingUpdatedAt,
              });
              lastSnapshot = nextSnapshot;
            }
          } finally {
            isPolling = false;
          }
        };

        send("connected", { snapshot: initialSnapshot });

        const pollInterval = setInterval(() => {
          poll().catch(() => {
            cleanup();
          });
        }, 1500);
        const heartbeatInterval = setInterval(() => {
          send("heartbeat", { timestamp: Date.now() });
        }, 15_000);

        request.signal.addEventListener("abort", cleanup, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      },
    });
  }
);
