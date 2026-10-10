import { mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";

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
  downloadJobColumns,
  downloadJobRow,
  libraryEntryColumns,
  notificationEndpointColumns,
  notificationEndpointRow,
  pushSubscriptionColumns,
  pushSubscriptionRow,
} from "@mangy/db/model";
import {
  BrowserPushError,
  getBrowserPushPublicKey,
  hasBrowserPushConfig,
  sendBrowserPush,
} from "@mangy/push";
import { Cause, Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { getPreferencesEffect } from "../notifications/service";

const activeDownloadJobStatuses = [
  "queued",
  "running",
  "retryableFailed",
] as const;

interface UserProfile {
  email: string;
  name: string;
}

interface BrowserPushPreferencesInput {
  isEnabled: boolean;
  notifyOnDownloadCompleted: boolean;
  notifyOnDownloadFailed: boolean;
  notifyOnTrackedSeriesUpdate: boolean;
  notifyOnSystemWarning: boolean;
}

interface BrowserPushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
}

const defaultBrowserPushPreferences: BrowserPushPreferencesInput = {
  isEnabled: false,
  notifyOnDownloadCompleted: true,
  notifyOnDownloadFailed: true,
  notifyOnSystemWarning: true,
  notifyOnTrackedSeriesUpdate: true,
};

const toIsoString = (value: Date | null): string | null => {
  return value ? value.toISOString() : null;
};

const browserPushEndpointProjection = Schema.Struct({
  id: notificationEndpointRow.fields.id,
  is_enabled: notificationEndpointRow.fields.is_enabled,
  last_delivered_at: notificationEndpointRow.fields.last_delivered_at,
  last_error: notificationEndpointRow.fields.last_error,
  last_error_at: notificationEndpointRow.fields.last_error_at,
  notify_on_download_completed:
    notificationEndpointRow.fields.notify_on_download_completed,
  notify_on_download_failed:
    notificationEndpointRow.fields.notify_on_download_failed,
  notify_on_system_warning:
    notificationEndpointRow.fields.notify_on_system_warning,
  notify_on_tracked_series_update:
    notificationEndpointRow.fields.notify_on_tracked_series_update,
});

type BrowserPushEndpoint = Schema.Schema.Type<
  typeof browserPushEndpointProjection
>;

const toBrowserPushEndpoint = (row: BrowserPushEndpoint) => ({
  id: row.id,
  isEnabled: row.is_enabled,
  lastDeliveredAt: row.last_delivered_at,
  lastError: row.last_error,
  lastErrorAt: row.last_error_at,
  notifyOnDownloadCompleted: row.notify_on_download_completed,
  notifyOnDownloadFailed: row.notify_on_download_failed,
  notifyOnSystemWarning: row.notify_on_system_warning,
  notifyOnTrackedSeriesUpdate: row.notify_on_tracked_series_update,
});

const getBrowserPushEndpointRecord = (userId: string) =>
  Effect.gen(function* getBrowserPushEndpointRecordEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      browserPushEndpointProjection,
      yield* sql`SELECT ${column(notificationEndpointColumns, "id")},
          ${column(notificationEndpointColumns, "isEnabled")},
          ${column(notificationEndpointColumns, "lastDeliveredAt")},
          ${column(notificationEndpointColumns, "lastError")},
          ${column(notificationEndpointColumns, "lastErrorAt")},
          ${column(notificationEndpointColumns, "notifyOnDownloadCompleted")},
          ${column(notificationEndpointColumns, "notifyOnDownloadFailed")},
          ${column(notificationEndpointColumns, "notifyOnTrackedSeriesUpdate")},
          ${column(notificationEndpointColumns, "notifyOnSystemWarning")}
        FROM ${table("notificationEndpoint")}
        WHERE ${column(notificationEndpointColumns, "userId")} = ${userId}
          AND ${column(notificationEndpointColumns, "type")} = ${"browserPush"}
        LIMIT 1`
    );

    const [record] = rows;

    return record ? toBrowserPushEndpoint(record) : null;
  });

const countActivePushSubscriptions = (userId: string) =>
  Effect.gen(function* countActivePushSubscriptionsEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({ id: pushSubscriptionRow.fields.id }),
      yield* sql`SELECT ${column(pushSubscriptionColumns, "id")} FROM ${table("pushSubscription")}
        WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}
          AND ${column(pushSubscriptionColumns, "isActive")} = ${true}`
    );

    return rows.length;
  });

const upsertBrowserPushEndpoint = (
  userId: string,
  input: Partial<BrowserPushPreferencesInput>
) =>
  Effect.gen(function* upsertBrowserPushEndpointEffect() {
    const sql = yield* SqlClient.SqlClient;
    const existingRows = yield* decodeRows(
      browserPushEndpointProjection,
      yield* sql`SELECT ${column(notificationEndpointColumns, "id")},
          ${column(notificationEndpointColumns, "isEnabled")},
          ${column(notificationEndpointColumns, "lastDeliveredAt")},
          ${column(notificationEndpointColumns, "lastError")},
          ${column(notificationEndpointColumns, "lastErrorAt")},
          ${column(notificationEndpointColumns, "notifyOnDownloadCompleted")},
          ${column(notificationEndpointColumns, "notifyOnDownloadFailed")},
          ${column(notificationEndpointColumns, "notifyOnTrackedSeriesUpdate")},
          ${column(notificationEndpointColumns, "notifyOnSystemWarning")}
        FROM ${table("notificationEndpoint")}
        WHERE ${column(notificationEndpointColumns, "userId")} = ${userId}
          AND ${column(notificationEndpointColumns, "type")} = ${"browserPush"}
        LIMIT 1`
    );
    const [existingEndpointRow] = existingRows;
    const existingEndpoint = existingEndpointRow
      ? toBrowserPushEndpoint(existingEndpointRow)
      : null;

    const values = {
      isEnabled:
        input.isEnabled ??
        existingEndpoint?.isEnabled ??
        defaultBrowserPushPreferences.isEnabled,
      notifyOnDownloadCompleted:
        input.notifyOnDownloadCompleted ??
        existingEndpoint?.notifyOnDownloadCompleted ??
        defaultBrowserPushPreferences.notifyOnDownloadCompleted,
      notifyOnDownloadFailed:
        input.notifyOnDownloadFailed ??
        existingEndpoint?.notifyOnDownloadFailed ??
        defaultBrowserPushPreferences.notifyOnDownloadFailed,
      notifyOnSystemWarning:
        input.notifyOnSystemWarning ??
        existingEndpoint?.notifyOnSystemWarning ??
        defaultBrowserPushPreferences.notifyOnSystemWarning,
      notifyOnTrackedSeriesUpdate:
        input.notifyOnTrackedSeriesUpdate ??
        existingEndpoint?.notifyOnTrackedSeriesUpdate ??
        defaultBrowserPushPreferences.notifyOnTrackedSeriesUpdate,
      updatedAt: new Date(),
    };

    if (existingEndpoint) {
      yield* sql`UPDATE ${table("notificationEndpoint")} SET ${updateRow(
        sql,
        notificationEndpointColumns,
        values
      )}
        WHERE ${column(notificationEndpointColumns, "id")} = ${existingEndpoint.id}`;

      return existingEndpoint.id;
    }

    const created = yield* decodeRows(
      Schema.Struct({ id: notificationEndpointRow.fields.id }),
      yield* sql`INSERT INTO ${table("notificationEndpoint")} ${insertRow(
        sql,
        notificationEndpointColumns,
        {
          id: crypto.randomUUID(),
          ...values,
          type: "browserPush",
          userId,
        }
      )}
        RETURNING ${column(notificationEndpointColumns, "id")}`
    );

    const [createdEndpoint] = created;
    if (!createdEndpoint) {
      throw new Error("Unable to save browser notification settings.");
    }

    return createdEndpoint.id;
  });

const toExpirationDate = (value: number | null | undefined): Date | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value);
};

const assertValidPushEndpoint = (value: string): void => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("Push subscriptions must include a valid endpoint URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Push subscriptions must use an HTTPS endpoint.");
  }
};

const updateBrowserPushObservability = (
  userId: string,
  input: {
    lastDeliveredAt?: Date | null;
    lastError?: string | null;
    lastErrorAt?: Date | null;
  }
) =>
  Effect.gen(function* updateBrowserPushObservabilityEffect() {
    const sql = yield* SqlClient.SqlClient;
    const endpoint = yield* getBrowserPushEndpointRecord(userId);

    if (!endpoint) {
      return;
    }

    yield* sql`UPDATE ${table("notificationEndpoint")} SET ${updateRow(
      sql,
      notificationEndpointColumns,
      {
        lastDeliveredAt:
          input.lastDeliveredAt === undefined
            ? endpoint.lastDeliveredAt
            : input.lastDeliveredAt,
        lastError:
          input.lastError === undefined ? endpoint.lastError : input.lastError,
        lastErrorAt:
          input.lastErrorAt === undefined
            ? endpoint.lastErrorAt
            : input.lastErrorAt,
        updatedAt: new Date(),
      }
    )}
      WHERE ${column(notificationEndpointColumns, "id")} = ${endpoint.id}`;
  });

const getBootstrap = (userId: string, profile: UserProfile) =>
  Effect.gen(function* getBootstrapEffect() {
    const sql = yield* SqlClient.SqlClient;
    const [destinations, notifications] = yield* Effect.all(
      [
        Effect.gen(function* destinationRows() {
          return yield* decodeRows(
            Schema.Struct({
              id: downloadDestinationRow.fields.id,
              name: downloadDestinationRow.fields.name,
              absolute_path: downloadDestinationRow.fields.absolute_path,
              komga_library_id: downloadDestinationRow.fields.komga_library_id,
              is_default: downloadDestinationRow.fields.is_default,
              is_enabled: downloadDestinationRow.fields.is_enabled,
            }),
            yield* sql`SELECT ${column(downloadDestinationColumns, "id")},
                ${column(downloadDestinationColumns, "name")},
                ${column(downloadDestinationColumns, "absolutePath")},
                ${column(downloadDestinationColumns, "komgaLibraryId")},
                ${column(downloadDestinationColumns, "isDefault")},
                ${column(downloadDestinationColumns, "isEnabled")}
              FROM ${table("downloadDestination")}
              WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}
              ORDER BY ${column(downloadDestinationColumns, "name")} ASC`
          );
        }),
        getPreferencesEffect(userId),
      ],
      { concurrency: "unbounded" }
    );

    return {
      destinations: destinations.map((destination) => ({
        id: destination.id,
        name: destination.name,
        absolutePath: destination.absolute_path,
        komgaLibraryId: destination.komga_library_id ?? null,
        isDefault: destination.is_default,
        isEnabled: destination.is_enabled,
      })),
      notifications,
      profile,
    };
  });

const getBrowserPushSettings = (userId: string) =>
  Effect.gen(function* getBrowserPushSettingsEffect() {
    const [endpoint, activeSubscriptionCount] = yield* Effect.all(
      [
        getBrowserPushEndpointRecord(userId),
        countActivePushSubscriptions(userId),
      ],
      { concurrency: "unbounded" }
    );

    return {
      activeSubscriptionCount,
      isConfigured: hasBrowserPushConfig(),
      isEnabled: endpoint?.isEnabled ?? defaultBrowserPushPreferences.isEnabled,
      lastDeliveredAt: toIsoString(endpoint?.lastDeliveredAt ?? null),
      lastError: endpoint?.lastError ?? null,
      lastErrorAt: toIsoString(endpoint?.lastErrorAt ?? null),
      notifyOnDownloadCompleted:
        endpoint?.notifyOnDownloadCompleted ??
        defaultBrowserPushPreferences.notifyOnDownloadCompleted,
      notifyOnDownloadFailed:
        endpoint?.notifyOnDownloadFailed ??
        defaultBrowserPushPreferences.notifyOnDownloadFailed,
      notifyOnTrackedSeriesUpdate:
        endpoint?.notifyOnTrackedSeriesUpdate ??
        defaultBrowserPushPreferences.notifyOnTrackedSeriesUpdate,
      notifyOnSystemWarning:
        endpoint?.notifyOnSystemWarning ??
        defaultBrowserPushPreferences.notifyOnSystemWarning,
      vapidPublicKey: getBrowserPushPublicKey(),
    };
  });

const updateBrowserPushPreferences = (
  userId: string,
  input: BrowserPushPreferencesInput
) =>
  Effect.gen(function* updateBrowserPushPreferencesEffect() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.withTransaction(upsertBrowserPushEndpoint(userId, input));

    return yield* getBrowserPushSettings(userId);
  });

const savePushSubscription = (
  userId: string,
  input: BrowserPushSubscriptionInput
) =>
  Effect.gen(function* savePushSubscriptionEffect() {
    const sql = yield* SqlClient.SqlClient;
    assertValidPushEndpoint(input.endpoint);

    yield* sql.withTransaction(
      Effect.gen(function* saveSubscription() {
        yield* upsertBrowserPushEndpoint(userId, { isEnabled: true });

        const existing = yield* decodeRows(
          Schema.Struct({ id: pushSubscriptionRow.fields.id }),
          yield* sql`SELECT ${column(pushSubscriptionColumns, "id")} FROM ${table("pushSubscription")}
            WHERE ${column(pushSubscriptionColumns, "endpoint")} = ${input.endpoint}
            LIMIT 1`
        );

        const values = {
          auth: input.keys.auth,
          endpoint: input.endpoint,
          expirationTime: toExpirationDate(input.expirationTime),
          isActive: true,
          lastError: null,
          lastSeenAt: new Date(),
          p256dh: input.keys.p256dh,
          updatedAt: new Date(),
          userAgent: input.userAgent?.trim() || null,
          userId,
        };

        const [existingSubscription] = existing;
        if (existingSubscription) {
          yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
            sql,
            pushSubscriptionColumns,
            values
          )}
            WHERE ${column(pushSubscriptionColumns, "id")} = ${existingSubscription.id}`;
        } else {
          yield* sql`INSERT INTO ${table("pushSubscription")} ${insertRow(
            sql,
            pushSubscriptionColumns,
            { id: crypto.randomUUID(), ...values }
          )}`;
        }
      })
    );

    return yield* getBrowserPushSettings(userId);
  });

const removePushSubscription = (userId: string, input: { endpoint: string }) =>
  Effect.gen(function* removePushSubscriptionEffect() {
    const sql = yield* SqlClient.SqlClient;
    assertValidPushEndpoint(input.endpoint);

    yield* sql.withTransaction(
      Effect.gen(function* removeSubscription() {
        yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
          sql,
          pushSubscriptionColumns,
          {
            isActive: false,
            lastError: null,
            updatedAt: new Date(),
          }
        )}
          WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}
            AND ${column(pushSubscriptionColumns, "endpoint")} = ${input.endpoint}`;

        const remainingSubscriptions = yield* decodeRows(
          Schema.Struct({ id: pushSubscriptionRow.fields.id }),
          yield* sql`SELECT ${column(pushSubscriptionColumns, "id")} FROM ${table("pushSubscription")}
            WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}
              AND ${column(pushSubscriptionColumns, "isActive")} = ${true}
            LIMIT 1`
        );

        if (remainingSubscriptions.length === 0) {
          yield* upsertBrowserPushEndpoint(userId, { isEnabled: false });
        }
      })
    );

    return yield* getBrowserPushSettings(userId);
  });

const sendTestBrowserPush = (userId: string) =>
  Effect.gen(function* sendTestBrowserPushEffect() {
    const sql = yield* SqlClient.SqlClient;
    const subscriptions = yield* decodeRows(
      Schema.Struct({
        auth: pushSubscriptionRow.fields.auth,
        endpoint: pushSubscriptionRow.fields.endpoint,
        id: pushSubscriptionRow.fields.id,
        p256dh: pushSubscriptionRow.fields.p256dh,
      }),
      yield* sql`SELECT ${column(pushSubscriptionColumns, "auth")},
          ${column(pushSubscriptionColumns, "endpoint")},
          ${column(pushSubscriptionColumns, "id")},
          ${column(pushSubscriptionColumns, "p256dh")}
        FROM ${table("pushSubscription")}
        WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}
          AND ${column(pushSubscriptionColumns, "isActive")} = ${true}`
    );

    if (subscriptions.length === 0) {
      throw new Error("Connect a browser before sending a test notification.");
    }

    let deliveredCount = 0;
    let lastError: BrowserPushError | Error | null = null;

    for (const subscription of subscriptions) {
      const outcome = yield* Effect.exit(
        Effect.promise(() =>
          sendBrowserPush(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            {
              body: "Mangy can send browser notifications to this browser.",
              tag: "browser-push-test",
              title: "Browser notifications ready",
              type: "systemWarning",
              url: "/notifications",
            }
          )
        )
      );

      if (Exit.isSuccess(outcome)) {
        deliveredCount += 1;

        yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
          sql,
          pushSubscriptionColumns,
          {
            lastError: null,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          }
        )}
          WHERE ${column(pushSubscriptionColumns, "id")} = ${subscription.id}`;

        continue;
      }

      const error = Cause.squash(outcome.cause);
      const pushError =
        error instanceof BrowserPushError
          ? error
          : new BrowserPushError(
              error instanceof Error && error.message.trim().length > 0
                ? error.message
                : "Unable to send a browser test notification."
            );

      lastError = pushError;

      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
          sql,
          pushSubscriptionColumns,
          {
            isActive: false,
            lastError: pushError.message,
            updatedAt: new Date(),
          }
        )}
          WHERE ${column(pushSubscriptionColumns, "id")} = ${subscription.id}`;
      } else {
        yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
          sql,
          pushSubscriptionColumns,
          {
            lastError: pushError.message,
            updatedAt: new Date(),
          }
        )}
          WHERE ${column(pushSubscriptionColumns, "id")} = ${subscription.id}`;
      }
    }

    if (deliveredCount > 0) {
      yield* updateBrowserPushObservability(userId, {
        lastDeliveredAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      });

      return { deliveredCount };
    }

    yield* updateBrowserPushObservability(userId, {
      lastError:
        lastError?.message ?? "Unable to send a browser test notification.",
      lastErrorAt: new Date(),
    });

    throw lastError ?? new Error("Unable to send a browser test notification.");
  });

const createDestination = (
  userId: string,
  input: {
    name: string;
    absolutePath: string;
    komgaLibraryId?: string;
    isDefault?: boolean;
  }
) =>
  Effect.gen(function* createDestinationEffect() {
    const sql = yield* SqlClient.SqlClient;
    const absolutePath = input.absolutePath.trim();
    if (!isAbsolute(absolutePath)) {
      throw new Error("Destination paths must be absolute.");
    }

    yield* Effect.promise(() => mkdir(absolutePath, { recursive: true }));

    return yield* sql.withTransaction(
      Effect.gen(function* createDestinationRow() {
        const existingDestinations = yield* decodeRows(
          Schema.Struct({ id: downloadDestinationRow.fields.id }),
          yield* sql`SELECT ${column(downloadDestinationColumns, "id")} FROM ${table("downloadDestination")}
            WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}`
        );

        const shouldBeDefault =
          input.isDefault === true || existingDestinations.length === 0;

        if (shouldBeDefault) {
          yield* sql`UPDATE ${table("downloadDestination")} SET ${updateRow(
            sql,
            downloadDestinationColumns,
            { isDefault: false, updatedAt: new Date() }
          )}
            WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}`;
        }

        const rows = yield* decodeRows(
          Schema.Struct({
            id: downloadDestinationRow.fields.id,
            name: downloadDestinationRow.fields.name,
            absolute_path: downloadDestinationRow.fields.absolute_path,
            komga_library_id: downloadDestinationRow.fields.komga_library_id,
            is_default: downloadDestinationRow.fields.is_default,
            is_enabled: downloadDestinationRow.fields.is_enabled,
          }),
          yield* sql`INSERT INTO ${table("downloadDestination")} ${insertRow(
            sql,
            downloadDestinationColumns,
            {
              id: crypto.randomUUID(),
              absolutePath,
              isDefault: shouldBeDefault,
              komgaLibraryId: input.komgaLibraryId?.trim() || null,
              name: input.name.trim(),
              userId,
            }
          )}
            RETURNING ${column(downloadDestinationColumns, "id")},
              ${column(downloadDestinationColumns, "name")},
              ${column(downloadDestinationColumns, "absolutePath")},
              ${column(downloadDestinationColumns, "komgaLibraryId")},
              ${column(downloadDestinationColumns, "isDefault")},
              ${column(downloadDestinationColumns, "isEnabled")}`
        );

        const [destination] = rows;
        if (!destination) {
          throw new Error("Unable to save this destination.");
        }

        return {
          id: destination.id,
          name: destination.name,
          absolutePath: destination.absolute_path,
          komgaLibraryId: destination.komga_library_id ?? null,
          isDefault: destination.is_default,
          isEnabled: destination.is_enabled,
        };
      })
    );
  });

const deleteDestination = (userId: string, destinationId: string) =>
  Effect.gen(function* deleteDestinationEffect() {
    const sql = yield* SqlClient.SqlClient;

    return yield* sql.withTransaction(
      Effect.gen(function* deleteDestinationRow() {
        const destinations = yield* decodeRows(
          Schema.Struct({
            id: downloadDestinationRow.fields.id,
            is_default: downloadDestinationRow.fields.is_default,
            is_enabled: downloadDestinationRow.fields.is_enabled,
          }),
          yield* sql`SELECT ${column(downloadDestinationColumns, "id")},
              ${column(downloadDestinationColumns, "isDefault")},
              ${column(downloadDestinationColumns, "isEnabled")}
            FROM ${table("downloadDestination")}
            WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}
            ORDER BY ${column(downloadDestinationColumns, "name")} ASC`
        );

        const destination = destinations.find(
          (item) => item.id === destinationId
        );
        if (!destination) {
          throw new Error("Destination not found.");
        }

        const activeJobs = yield* decodeRows(
          Schema.Struct({ id: downloadJobRow.fields.id }),
          yield* sql`SELECT ${column(downloadJobColumns, "id")} FROM ${table("downloadJob")}
            WHERE ${column(downloadJobColumns, "userId")} = ${userId}
              AND ${column(downloadJobColumns, "downloadDestinationId")} = ${destinationId}
              AND ${column(downloadJobColumns, "status")} IN ${sql.in(activeDownloadJobStatuses)}
            LIMIT 1`
        );

        if (activeJobs[0]) {
          throw new Error(
            "This destination is still used by queued or running downloads. Cancel or finish those jobs first."
          );
        }

        const fallbackDestination = destination.is_default
          ? (destinations.find(
              (item) => item.id !== destinationId && item.is_enabled
            ) ?? destinations.find((item) => item.id !== destinationId))
          : null;
        const now = new Date();

        yield* sql`UPDATE ${table("libraryEntry")} SET ${updateRow(
          sql,
          libraryEntryColumns,
          {
            autoDownload: false,
            downloadDestinationId: null,
            updatedAt: now,
          }
        )}
          WHERE ${column(libraryEntryColumns, "downloadDestinationId")} = ${destinationId}`;

        yield* sql`DELETE FROM ${table("downloadDestination")}
          WHERE ${column(downloadDestinationColumns, "id")} = ${destinationId}
            AND ${column(downloadDestinationColumns, "userId")} = ${userId}`;

        if (destination.is_default && fallbackDestination) {
          yield* sql`UPDATE ${table("downloadDestination")} SET ${updateRow(
            sql,
            downloadDestinationColumns,
            { isDefault: false, updatedAt: now }
          )}
            WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}`;

          yield* sql`UPDATE ${table("downloadDestination")} SET ${updateRow(
            sql,
            downloadDestinationColumns,
            { isDefault: true, updatedAt: now }
          )}
            WHERE ${column(downloadDestinationColumns, "id")} = ${fallbackDestination.id}`;
        }

        return { id: destinationId };
      })
    );
  });

export const SettingsService = {
  async getBootstrap(userId: string, profile: UserProfile) {
    return await runSql(getBootstrap(userId, profile));
  },

  async getBrowserPushSettings(userId: string) {
    return await runSql(getBrowserPushSettings(userId));
  },

  async updateBrowserPushPreferences(
    userId: string,
    input: BrowserPushPreferencesInput
  ) {
    return await runSql(updateBrowserPushPreferences(userId, input));
  },

  async savePushSubscription(
    userId: string,
    input: BrowserPushSubscriptionInput
  ) {
    return await runSql(savePushSubscription(userId, input));
  },

  async removePushSubscription(userId: string, input: { endpoint: string }) {
    return await runSql(removePushSubscription(userId, input));
  },

  async sendTestBrowserPush(userId: string) {
    return await runSql(sendTestBrowserPush(userId));
  },

  async createDestination(
    userId: string,
    input: {
      name: string;
      absolutePath: string;
      komgaLibraryId?: string;
      isDefault?: boolean;
    }
  ) {
    return await runSql(createDestination(userId, input));
  },

  async deleteDestination(userId: string, destinationId: string) {
    return await runSql(deleteDestination(userId, destinationId));
  },
};
