import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  Notification,
  NotificationEndpoint,
  notificationColumns,
  notificationEndpointColumns,
  notificationRow,
} from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

const list = (userId: string) =>
  Effect.gen(function* listEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      notificationRow,
      yield* sql`SELECT * FROM ${table("notification")}
        WHERE ${column(notificationColumns, "userId")} = ${userId}
        ORDER BY ${column(notificationColumns, "createdAt")} DESC`
    );

    return rows.map((row) => ({
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      isRead: row.isRead,
      title: row.title,
      type: row.type,
    }));
  });

const markRead = (userId: string, notificationId: string) =>
  Effect.gen(function* markReadEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({
        body: Notification.fields.body,
        created_at: Notification.fields.createdAt,
        id: Notification.fields.id,
        is_read: Notification.fields.isRead,
        title: Notification.fields.title,
        type: Notification.fields.type,
      }),
      yield* sql`UPDATE ${table("notification")}
        SET ${updateRow(sql, notificationColumns, {
          isRead: true,
          updatedAt: new Date(),
        })}
        WHERE ${column(notificationColumns, "userId")} = ${userId}
          AND ${column(notificationColumns, "id")} = ${notificationId}
        RETURNING ${column(notificationColumns, "id")},
          ${column(notificationColumns, "type")},
          ${column(notificationColumns, "title")},
          ${column(notificationColumns, "body")},
          ${column(notificationColumns, "isRead")},
          ${column(notificationColumns, "createdAt")}`
    );

    const [record] = rows;
    if (!record) {
      throw new Error("Notification not found.");
    }

    return {
      body: record.body,
      createdAt: record.created_at.toISOString(),
      id: record.id,
      isRead: record.is_read,
      title: record.title,
      type: record.type,
    };
  });

const markAllRead = (userId: string) =>
  Effect.gen(function* markAllReadEffect() {
    const sql = yield* SqlClient.SqlClient;
    const records = yield* decodeRows(
      Schema.Struct({ id: Notification.fields.id }),
      yield* sql`UPDATE ${table("notification")}
        SET ${updateRow(sql, notificationColumns, {
          isRead: true,
          updatedAt: new Date(),
        })}
        WHERE ${column(notificationColumns, "userId")} = ${userId}
          AND ${column(notificationColumns, "isRead")} = ${false}
        RETURNING ${column(notificationColumns, "id")}`
    );

    return { updatedCount: records.length };
  });

const getPreferences = (userId: string) =>
  Effect.gen(function* getPreferencesEffect() {
    const sql = yield* SqlClient.SqlClient;
    const [endpoint, unreadRecord] = yield* Effect.all(
      [
        Effect.gen(function* inAppEndpoint() {
          const rows = yield* decodeRows(
            Schema.Struct({
              is_enabled: NotificationEndpoint.fields.isEnabled,
            }),
            yield* sql`SELECT ${column(notificationEndpointColumns, "isEnabled")} FROM ${table("notificationEndpoint")}
              WHERE ${column(notificationEndpointColumns, "userId")} = ${userId}
                AND ${column(notificationEndpointColumns, "type")} = ${"inApp"}
              LIMIT 1`
          );

          return rows[0] ?? null;
        }),
        Effect.gen(function* unreadCount() {
          const rows = yield* decodeRows(
            Schema.Struct({ count: Schema.Int }),
            yield* sql`SELECT COUNT(*)::int AS count FROM ${table("notification")}
              WHERE ${column(notificationColumns, "userId")} = ${userId}
                AND ${column(notificationColumns, "isRead")} = ${false}`
          );

          return rows[0] ?? { count: 0 };
        }),
      ],
      { concurrency: "unbounded" }
    );

    return {
      inAppEnabled: endpoint?.is_enabled ?? true,
      unreadCount: unreadRecord.count,
    };
  });

const updatePreferences = (userId: string, input: { inAppEnabled: boolean }) =>
  Effect.gen(function* updatePreferencesEffect() {
    const sql = yield* SqlClient.SqlClient;
    const existing = yield* decodeRows(
      Schema.Struct({ id: NotificationEndpoint.fields.id }),
      yield* sql`SELECT ${column(notificationEndpointColumns, "id")} FROM ${table("notificationEndpoint")}
        WHERE ${column(notificationEndpointColumns, "userId")} = ${userId}
          AND ${column(notificationEndpointColumns, "type")} = ${"inApp"}
        LIMIT 1`
    );

    const [existingEndpoint] = existing;
    const endpointStatement = existingEndpoint
      ? sql`UPDATE ${table("notificationEndpoint")}
        SET ${updateRow(sql, notificationEndpointColumns, {
          isEnabled: input.inAppEnabled,
          updatedAt: new Date(),
        })}
        WHERE ${column(notificationEndpointColumns, "id")} = ${existingEndpoint.id}`
      : sql`INSERT INTO ${table("notificationEndpoint")} ${insertRow(
          sql,
          notificationEndpointColumns,
          {
            id: crypto.randomUUID(),
            isEnabled: input.inAppEnabled,
            type: "inApp",
            userId,
          }
        )}`;

    yield* endpointStatement;

    return yield* getPreferences(userId);
  });

export { getPreferences as getPreferencesEffect };

export const NotificationsService = {
  async getPreferences(userId: string) {
    return await runSql(getPreferences(userId));
  },

  async list(userId: string) {
    return await runSql(list(userId));
  },

  async markAllRead(userId: string) {
    return await runSql(markAllRead(userId));
  },

  async markRead(userId: string, notificationId: string) {
    return await runSql(markRead(userId, notificationId));
  },

  async updatePreferences(userId: string, input: { inAppEnabled: boolean }) {
    return await runSql(updatePreferences(userId, input));
  },
};
