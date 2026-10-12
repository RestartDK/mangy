import { constants } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  CreateDestination,
  CreateKomgaDestination,
} from "@mangy/contract";
import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  DownloadDestination,
  DownloadJob,
  NotificationEndpoint,
  PushSubscription,
  decodeKomgaLibraryId,
  downloadDestinationColumns,
  downloadJobColumns,
  libraryEntryColumns,
  notificationEndpointColumns,
  pushSubscriptionColumns,
} from "@mangy/db/model";
import type {
  DownloadDestinationId,
  KomgaLibraryId,
  UserId,
} from "@mangy/db/model";
import { hasKomgaConfig, listKomgaLibraries } from "@mangy/komga";
import {
  BrowserPushError,
  getBrowserPushPublicKey,
  hasBrowserPushConfig,
  sendBrowserPush,
} from "@mangy/push";
import { Cause, Effect, Exit, Option, Schema } from "effect";
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

const toIsoString = (value: Option.Option<Date>): Option.Option<string> =>
  value.pipe(Option.map((date) => date.toISOString()));

const browserPushEndpointProjection = Schema.Struct({
  id: NotificationEndpoint.fields.id,
  is_enabled: NotificationEndpoint.fields.isEnabled,
  last_delivered_at: NotificationEndpoint.fields.lastDeliveredAt,
  last_error: NotificationEndpoint.fields.lastError,
  last_error_at: NotificationEndpoint.fields.lastErrorAt,
  notify_on_download_completed:
    NotificationEndpoint.fields.notifyOnDownloadCompleted,
  notify_on_download_failed: NotificationEndpoint.fields.notifyOnDownloadFailed,
  notify_on_system_warning: NotificationEndpoint.fields.notifyOnSystemWarning,
  notify_on_tracked_series_update:
    NotificationEndpoint.fields.notifyOnTrackedSeriesUpdate,
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

const getBrowserPushEndpointRecord = (userId: UserId) =>
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

const countActivePushSubscriptions = (userId: UserId) =>
  Effect.gen(function* countActivePushSubscriptionsEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({ id: PushSubscription.fields.id }),
      yield* sql`SELECT ${column(pushSubscriptionColumns, "id")} FROM ${table("pushSubscription")}
        WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}
          AND ${column(pushSubscriptionColumns, "isActive")} = ${true}`
    );

    return rows.length;
  });

const upsertBrowserPushEndpoint = (
  userId: UserId,
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
      Schema.Struct({ id: NotificationEndpoint.fields.id }),
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
  userId: UserId,
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
            ? Option.getOrNull(endpoint.lastDeliveredAt)
            : input.lastDeliveredAt,
        lastError:
          input.lastError === undefined
            ? Option.getOrNull(endpoint.lastError)
            : input.lastError,
        lastErrorAt:
          input.lastErrorAt === undefined
            ? Option.getOrNull(endpoint.lastErrorAt)
            : input.lastErrorAt,
        updatedAt: new Date(),
      }
    )}
      WHERE ${column(notificationEndpointColumns, "id")} = ${endpoint.id}`;
  });

const getBootstrap = (userId: UserId, profile: UserProfile) =>
  Effect.gen(function* getBootstrapEffect() {
    const sql = yield* SqlClient.SqlClient;
    const [destinations, notifications] = yield* Effect.all(
      [
        Effect.gen(function* destinationRows() {
          return yield* decodeRows(
            Schema.Struct({
              absolute_path: DownloadDestination.fields.absolutePath,
              id: DownloadDestination.fields.id,
              is_default: DownloadDestination.fields.isDefault,
              is_enabled: DownloadDestination.fields.isEnabled,
              komga_library_id: DownloadDestination.fields.komgaLibraryId,
              name: DownloadDestination.fields.name,
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
        absolutePath: destination.absolute_path,
        id: destination.id,
        isDefault: destination.is_default,
        isEnabled: destination.is_enabled,
        komgaLibraryId: destination.komga_library_id,
        name: destination.name,
      })),
      notifications,
      profile,
    };
  });

const getBrowserPushSettings = (userId: UserId) =>
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
      lastDeliveredAt: toIsoString(
        endpoint === null ? Option.none() : endpoint.lastDeliveredAt
      ),
      lastError: endpoint === null ? Option.none() : endpoint.lastError,
      lastErrorAt: toIsoString(
        endpoint === null ? Option.none() : endpoint.lastErrorAt
      ),
      notifyOnDownloadCompleted:
        endpoint?.notifyOnDownloadCompleted ??
        defaultBrowserPushPreferences.notifyOnDownloadCompleted,
      notifyOnDownloadFailed:
        endpoint?.notifyOnDownloadFailed ??
        defaultBrowserPushPreferences.notifyOnDownloadFailed,
      notifyOnSystemWarning:
        endpoint?.notifyOnSystemWarning ??
        defaultBrowserPushPreferences.notifyOnSystemWarning,
      notifyOnTrackedSeriesUpdate:
        endpoint?.notifyOnTrackedSeriesUpdate ??
        defaultBrowserPushPreferences.notifyOnTrackedSeriesUpdate,
      vapidPublicKey: getBrowserPushPublicKey(),
    };
  });

const updateBrowserPushPreferences = (
  userId: UserId,
  input: BrowserPushPreferencesInput
) =>
  Effect.gen(function* updateBrowserPushPreferencesEffect() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.withTransaction(upsertBrowserPushEndpoint(userId, input));

    return yield* getBrowserPushSettings(userId);
  });

const savePushSubscription = (
  userId: UserId,
  input: BrowserPushSubscriptionInput
) =>
  Effect.gen(function* savePushSubscriptionEffect() {
    const sql = yield* SqlClient.SqlClient;
    assertValidPushEndpoint(input.endpoint);

    yield* sql.withTransaction(
      Effect.gen(function* saveSubscription() {
        yield* upsertBrowserPushEndpoint(userId, { isEnabled: true });

        const existing = yield* decodeRows(
          Schema.Struct({ id: PushSubscription.fields.id }),
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
          userAgent: input.userAgent?.trim() ?? null,
          userId,
        };

        const [existingSubscription] = existing;
        const subscriptionStatement = existingSubscription
          ? sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
              sql,
              pushSubscriptionColumns,
              values
            )}
              WHERE ${column(pushSubscriptionColumns, "id")} = ${existingSubscription.id}`
          : sql`INSERT INTO ${table("pushSubscription")} ${insertRow(
              sql,
              pushSubscriptionColumns,
              { id: crypto.randomUUID(), ...values }
            )}`;

        yield* subscriptionStatement;
      })
    );

    return yield* getBrowserPushSettings(userId);
  });

const removePushSubscription = (userId: UserId, input: { endpoint: string }) =>
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
          Schema.Struct({ id: PushSubscription.fields.id }),
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

const sendTestBrowserPush = (userId: UserId) =>
  Effect.gen(function* sendTestBrowserPushEffect() {
    const sql = yield* SqlClient.SqlClient;
    const subscriptions = yield* decodeRows(
      Schema.Struct({
        auth: PushSubscription.fields.auth,
        endpoint: PushSubscription.fields.endpoint,
        id: PushSubscription.fields.id,
        p256dh: PushSubscription.fields.p256dh,
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
        Effect.promise(async () => {
          await sendBrowserPush(
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
          );
        })
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

      const subscriptionIsGone =
        pushError.statusCode === 404 || pushError.statusCode === 410;

      yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
        sql,
        pushSubscriptionColumns,
        subscriptionIsGone
          ? {
              isActive: false,
              lastError: pushError.message,
              updatedAt: new Date(),
            }
          : {
              lastError: pushError.message,
              updatedAt: new Date(),
            }
      )}
        WHERE ${column(pushSubscriptionColumns, "id")} = ${subscription.id}`;
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

const assertDestinationFolder = async (directory: string): Promise<void> => {
  if (!path.isAbsolute(directory)) {
    throw new Error("Destination folders must be absolute paths.");
  }

  const isFolder = await stat(directory).then(
    (stats) => stats.isDirectory(),
    () => false
  );
  if (!isFolder) {
    throw new Error(`${directory} is not an existing folder.`);
  }

  try {
    await access(directory, constants.X_OK);
    await access(directory, constants.W_OK);
  } catch {
    throw new Error(`Cannot write downloads to ${directory}.`);
  }
};

interface DestinationRowInput {
  absolutePath: string;
  isDefault: boolean | undefined;
  komgaLibraryId: KomgaLibraryId | null;
  name: string;
}

const insertDestination = (userId: UserId, input: DestinationRowInput) =>
  Effect.gen(function* insertDestinationEffect() {
    const sql = yield* SqlClient.SqlClient;

    return yield* sql.withTransaction(
      Effect.gen(function* createDestinationRow() {
        const existingDestinations = yield* decodeRows(
          Schema.Struct({ id: DownloadDestination.fields.id }),
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
            absolute_path: DownloadDestination.fields.absolutePath,
            id: DownloadDestination.fields.id,
            is_default: DownloadDestination.fields.isDefault,
            is_enabled: DownloadDestination.fields.isEnabled,
            komga_library_id: DownloadDestination.fields.komgaLibraryId,
            name: DownloadDestination.fields.name,
          }),
          yield* sql`INSERT INTO ${table("downloadDestination")} ${insertRow(
            sql,
            downloadDestinationColumns,
            {
              absolutePath: input.absolutePath,
              id: crypto.randomUUID(),
              isDefault: shouldBeDefault,
              komgaLibraryId: input.komgaLibraryId,
              name: input.name,
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
          absolutePath: destination.absolute_path,
          id: destination.id,
          isDefault: destination.is_default,
          isEnabled: destination.is_enabled,
          komgaLibraryId: destination.komga_library_id,
          name: destination.name,
        };
      })
    );
  });

const createManualDestination = (userId: UserId, input: CreateDestination) =>
  Effect.gen(function* createManualDestinationEffect() {
    if (!path.isAbsolute(input.absolutePath)) {
      throw new Error("Destination folders must be absolute paths.");
    }

    yield* Effect.promise(async () => {
      await mkdir(input.absolutePath, { recursive: true });
      await assertDestinationFolder(input.absolutePath);
    });

    return yield* insertDestination(userId, {
      absolutePath: input.absolutePath,
      isDefault: input.isDefault,
      komgaLibraryId: null,
      name: input.name,
    });
  });

const createKomgaDestination = (
  userId: UserId,
  input: CreateKomgaDestination
) =>
  Effect.gen(function* createKomgaDestinationEffect() {
    const libraries = yield* Effect.promise(
      async () => await listKomgaLibraries()
    );
    const library = libraries.find(
      (candidate) => candidate.id === input.komgaLibraryId
    );

    if (library === undefined) {
      throw new Error(`Komga has no library ${input.komgaLibraryId}.`);
    }

    yield* Effect.promise(async () => {
      await assertDestinationFolder(library.root);
    });

    return yield* insertDestination(userId, {
      absolutePath: library.root,
      isDefault: input.isDefault,
      komgaLibraryId: decodeKomgaLibraryId(library.id),
      name: input.name,
    });
  });

const deleteDestination = (
  userId: UserId,
  destinationId: DownloadDestinationId
) =>
  Effect.gen(function* deleteDestinationEffect() {
    const sql = yield* SqlClient.SqlClient;

    return yield* sql.withTransaction(
      Effect.gen(function* deleteDestinationRow() {
        const destinations = yield* decodeRows(
          Schema.Struct({
            id: DownloadDestination.fields.id,
            is_default: DownloadDestination.fields.isDefault,
            is_enabled: DownloadDestination.fields.isEnabled,
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
          Schema.Struct({ id: DownloadJob.fields.id }),
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
  async createDestination(userId: UserId, input: CreateDestination) {
    return await runSql(createManualDestination(userId, input));
  },

  async createKomgaDestination(
    userId: UserId,
    input: CreateKomgaDestination
  ) {
    return await runSql(createKomgaDestination(userId, input));
  },

  async deleteDestination(
    userId: UserId,
    destinationId: DownloadDestinationId
  ) {
    return await runSql(deleteDestination(userId, destinationId));
  },

  async getBootstrap(userId: UserId, profile: UserProfile) {
    return await runSql(getBootstrap(userId, profile));
  },

  async getBrowserPushSettings(userId: UserId) {
    return await runSql(getBrowserPushSettings(userId));
  },

  async getKomgaLibraries() {
    if (!hasKomgaConfig()) {
      return { isConfigured: false, libraries: [] };
    }

    const libraries = await listKomgaLibraries();

    return { isConfigured: true, libraries };
  },

  async removePushSubscription(userId: UserId, input: { endpoint: string }) {
    return await runSql(removePushSubscription(userId, input));
  },

  async savePushSubscription(
    userId: UserId,
    input: BrowserPushSubscriptionInput
  ) {
    return await runSql(savePushSubscription(userId, input));
  },

  async sendTestBrowserPush(userId: UserId) {
    return await runSql(sendTestBrowserPush(userId));
  },

  async updateBrowserPushPreferences(
    userId: UserId,
    input: BrowserPushPreferencesInput
  ) {
    return await runSql(updateBrowserPushPreferences(userId, input));
  },
};
