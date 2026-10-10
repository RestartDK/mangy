import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  notificationColumns,
  notificationDeliveryColumns,
  notificationDeliveryRow,
  notificationEndpointColumns,
  notificationEndpointRow,
  notificationRow,
  pushSubscriptionColumns,
  pushSubscriptionRow,
} from "@mangy/db/model";
import {
  BrowserPushError,
  type BrowserPushPayload,
  sendBrowserPush,
} from "@mangy/push";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

type NotificationType = Schema.Schema.Type<typeof notificationRow>["type"];

interface BrowserPushEndpointRecord {
  id: string;
  isEnabled: boolean;
  notifyOnDownloadCompleted: boolean;
  notifyOnDownloadFailed: boolean;
  notifyOnTrackedSeriesUpdate: boolean;
  notifyOnSystemWarning: boolean;
}

export interface ClaimedPushDelivery {
  attempts: number;
  id: string;
  maxAttempts: number;
  notificationBody: string;
  notificationEndpointId: string | null;
  notificationId: string;
  notificationTitle: string;
  notificationType: NotificationType;
  pushSubscriptionAuth: string | null;
  pushSubscriptionEndpoint: string | null;
  pushSubscriptionId: string | null;
  pushSubscriptionP256dh: string | null;
}

const claimedPushDeliveryProjection = Schema.Struct({
  attempts: notificationDeliveryRow.fields.attempts,
  id: notificationDeliveryRow.fields.id,
  maxAttempts: notificationDeliveryRow.fields.max_attempts,
  notificationBody: notificationRow.fields.body,
  notificationEndpointId:
    notificationDeliveryRow.fields.notification_endpoint_id,
  notificationId: notificationRow.fields.id,
  notificationTitle: notificationRow.fields.title,
  notificationType: notificationRow.fields.type,
  pushSubscriptionAuth: Schema.NullOr(pushSubscriptionRow.fields.auth),
  pushSubscriptionEndpoint: Schema.NullOr(pushSubscriptionRow.fields.endpoint),
  pushSubscriptionId: Schema.NullOr(pushSubscriptionRow.fields.id),
  pushSubscriptionP256dh: Schema.NullOr(pushSubscriptionRow.fields.p256dh),
});

const buildBrowserPushPayload = (
  delivery: ClaimedPushDelivery
): BrowserPushPayload => ({
  body: delivery.notificationBody,
  notificationId: delivery.notificationId,
  tag: `notification-${delivery.notificationId}`,
  title: delivery.notificationTitle,
  type: delivery.notificationType,
  url: "/notifications",
});

const shouldSendBrowserPush = (
  endpoint: BrowserPushEndpointRecord,
  type: NotificationType
): boolean => {
  if (!endpoint.isEnabled) {
    return false;
  }

  if (type === "downloadCompleted") {
    return endpoint.notifyOnDownloadCompleted;
  }

  if (type === "downloadFailed") {
    return endpoint.notifyOnDownloadFailed;
  }

  if (type === "trackedSeriesUpdated") {
    return endpoint.notifyOnTrackedSeriesUpdate;
  }

  return endpoint.notifyOnSystemWarning;
};

const getRetryDelayMs = (attempts: number): number => {
  return 15_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 4);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to deliver this browser notification.";
};

const createNotificationRecord = (input: {
  body: string;
  title: string;
  type: NotificationType;
  userId: string;
}) =>
  Effect.gen(function* createNotificationRecordEffect() {
    const sql = yield* SqlClient.SqlClient;
    const created = yield* decodeRows(
      Schema.Struct({ id: notificationRow.fields.id }),
      yield* sql`INSERT INTO ${table("notification")} ${insertRow(
        sql,
        notificationColumns,
        { id: crypto.randomUUID(), ...input }
      )}
        RETURNING ${column(notificationColumns, "id")}`
    );

    const [createdNotification] = created;
    if (!createdNotification) {
      throw new Error("Unable to create this notification.");
    }

    const endpointRows = yield* decodeRows(
      Schema.Struct({
        id: notificationEndpointRow.fields.id,
        is_enabled: notificationEndpointRow.fields.is_enabled,
        notify_on_download_completed:
          notificationEndpointRow.fields.notify_on_download_completed,
        notify_on_download_failed:
          notificationEndpointRow.fields.notify_on_download_failed,
        notify_on_system_warning:
          notificationEndpointRow.fields.notify_on_system_warning,
        notify_on_tracked_series_update:
          notificationEndpointRow.fields.notify_on_tracked_series_update,
      }),
      yield* sql`SELECT ${column(notificationEndpointColumns, "id")},
          ${column(notificationEndpointColumns, "isEnabled")},
          ${column(notificationEndpointColumns, "notifyOnDownloadCompleted")},
          ${column(notificationEndpointColumns, "notifyOnDownloadFailed")},
          ${column(notificationEndpointColumns, "notifyOnTrackedSeriesUpdate")},
          ${column(notificationEndpointColumns, "notifyOnSystemWarning")}
        FROM ${table("notificationEndpoint")}
        WHERE ${column(notificationEndpointColumns, "userId")} = ${input.userId}
          AND ${column(notificationEndpointColumns, "type")} = ${"browserPush"}
        LIMIT 1`
    );

    const [endpoint] = endpointRows;
    if (!endpoint) {
      return;
    }

    const browserPushEndpoint: BrowserPushEndpointRecord = {
      id: endpoint.id,
      isEnabled: endpoint.is_enabled,
      notifyOnDownloadCompleted: endpoint.notify_on_download_completed,
      notifyOnDownloadFailed: endpoint.notify_on_download_failed,
      notifyOnSystemWarning: endpoint.notify_on_system_warning,
      notifyOnTrackedSeriesUpdate: endpoint.notify_on_tracked_series_update,
    };

    if (!shouldSendBrowserPush(browserPushEndpoint, input.type)) {
      return;
    }

    const subscriptions = yield* decodeRows(
      Schema.Struct({ id: pushSubscriptionRow.fields.id }),
      yield* sql`SELECT ${column(pushSubscriptionColumns, "id")} FROM ${table("pushSubscription")}
        WHERE ${column(pushSubscriptionColumns, "userId")} = ${input.userId}
          AND ${column(pushSubscriptionColumns, "isActive")} = ${true}`
    );

    if (subscriptions.length === 0) {
      return;
    }

    yield* sql`INSERT INTO ${table("notificationDelivery")} ${insertRow(
      sql,
      notificationDeliveryColumns,
      subscriptions.map((subscription) => ({
        id: crypto.randomUUID(),
        channel: "browserPush" as const,
        notificationEndpointId: browserPushEndpoint.id,
        notificationId: createdNotification.id,
        pushSubscriptionId: subscription.id,
      }))
    )}`;
  });

export const queueNotification = (input: {
  body: string;
  title: string;
  type: NotificationType;
  userId: string;
}): Effect.Effect<void, unknown, SqlClient.SqlClient> =>
  createNotificationRecord(input);

export const claimNextPushDelivery = async (
  workerId: string
): Promise<ClaimedPushDelivery | null> => {
  const claimedDeliveryId = await runSql(
    Effect.gen(function* claimPushDelivery() {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql<{ id: string }>`
        update "notification_delivery"
        set
          "status" = 'running',
          "lease_owner" = ${workerId},
          "leased_at" = now(),
          "attempts" = "attempts" + 1,
          "updated_at" = now()
        where "id" = (
          select "id"
          from "notification_delivery"
          where "channel" = 'browserPush'
            and (
              "status" = 'queued'
              or (
                "status" = 'retryableFailed'
                and "attempts" < "max_attempts"
                and "next_attempt_at" <= now()
              )
            )
            and (
              "lease_owner" is null
              or "leased_at" is null
              or "leased_at" <= now() - interval '10 minutes'
            )
          order by "created_at" asc
          for update skip locked
          limit 1
        )
        returning "id";
      `;

      return rows[0]?.id ?? null;
    })
  );

  if (!claimedDeliveryId) {
    return null;
  }

  const delivery = await runSql(
    Effect.gen(function* loadPushDelivery() {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* decodeRows(
        claimedPushDeliveryProjection,
        yield* sql`SELECT ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "attempts")} AS ${sql("attempts")},
            ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "id")} AS ${sql("id")},
            ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "maxAttempts")} AS ${sql("maxAttempts")},
            ${table("notification")}.${column(notificationColumns, "body")} AS ${sql("notificationBody")},
            ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "notificationEndpointId")} AS ${sql("notificationEndpointId")},
            ${table("notification")}.${column(notificationColumns, "id")} AS ${sql("notificationId")},
            ${table("notification")}.${column(notificationColumns, "title")} AS ${sql("notificationTitle")},
            ${table("notification")}.${column(notificationColumns, "type")} AS ${sql("notificationType")},
            ${table("pushSubscription")}.${column(pushSubscriptionColumns, "auth")} AS ${sql("pushSubscriptionAuth")},
            ${table("pushSubscription")}.${column(pushSubscriptionColumns, "endpoint")} AS ${sql("pushSubscriptionEndpoint")},
            ${table("pushSubscription")}.${column(pushSubscriptionColumns, "id")} AS ${sql("pushSubscriptionId")},
            ${table("pushSubscription")}.${column(pushSubscriptionColumns, "p256dh")} AS ${sql("pushSubscriptionP256dh")}
          FROM ${table("notificationDelivery")}
          INNER JOIN ${table("notification")} ON ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "notificationId")} = ${table("notification")}.${column(notificationColumns, "id")}
          LEFT JOIN ${table("pushSubscription")} ON ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "pushSubscriptionId")} = ${table("pushSubscription")}.${column(pushSubscriptionColumns, "id")}
          WHERE ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "id")} = ${claimedDeliveryId}
          LIMIT 1`
      );

      return rows[0] ?? null;
    })
  );

  return delivery ?? null;
};

export const processPushDelivery = async (
  delivery: ClaimedPushDelivery
): Promise<void> => {
  if (
    !(
      delivery.pushSubscriptionEndpoint &&
      delivery.pushSubscriptionAuth &&
      delivery.pushSubscriptionP256dh
    )
  ) {
    throw new BrowserPushError(
      "This browser subscription is no longer valid.",
      {
        permanent: true,
      }
    );
  }

  await sendBrowserPush(
    {
      endpoint: delivery.pushSubscriptionEndpoint,
      keys: {
        auth: delivery.pushSubscriptionAuth,
        p256dh: delivery.pushSubscriptionP256dh,
      },
    },
    buildBrowserPushPayload(delivery)
  );

  const now = new Date();

  await runSql(
    Effect.gen(function* deliverPushDeliveryEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(
        Effect.gen(function* deliverPush() {
          yield* sql`UPDATE ${table("notificationDelivery")} SET ${updateRow(
            sql,
            notificationDeliveryColumns,
            {
              deliveredAt: now,
              lastError: null,
              leaseOwner: null,
              leasedAt: null,
              status: "delivered",
              updatedAt: now,
            }
          )}
            WHERE ${column(notificationDeliveryColumns, "id")} = ${delivery.id}`;

          if (delivery.notificationEndpointId) {
            yield* sql`UPDATE ${table("notificationEndpoint")} SET ${updateRow(
              sql,
              notificationEndpointColumns,
              {
                lastDeliveredAt: now,
                lastError: null,
                lastErrorAt: null,
                updatedAt: now,
              }
            )}
              WHERE ${column(notificationEndpointColumns, "id")} = ${delivery.notificationEndpointId}`;
          }

          if (delivery.pushSubscriptionId) {
            yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
              sql,
              pushSubscriptionColumns,
              {
                lastError: null,
                lastSeenAt: now,
                updatedAt: now,
              }
            )}
              WHERE ${column(pushSubscriptionColumns, "id")} = ${delivery.pushSubscriptionId}`;
          }
        })
      );
    })
  );
};

export const failPushDelivery = async (
  delivery: ClaimedPushDelivery,
  error: unknown
): Promise<void> => {
  const pushError =
    error instanceof BrowserPushError
      ? error
      : new BrowserPushError(getErrorMessage(error));
  const message = getErrorMessage(pushError);
  const now = new Date();
  const shouldDeactivateSubscription =
    pushError.statusCode === 404 || pushError.statusCode === 410;
  const shouldMarkPermanent =
    pushError.permanent || delivery.attempts >= delivery.maxAttempts;

  await runSql(
    Effect.gen(function* failPushDeliveryEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(
        Effect.gen(function* failPush() {
          yield* sql`UPDATE ${table("notificationDelivery")} SET ${updateRow(
            sql,
            notificationDeliveryColumns,
            {
              lastError: message,
              leaseOwner: null,
              leasedAt: null,
              nextAttemptAt: new Date(
                now.getTime() + getRetryDelayMs(delivery.attempts)
              ),
              status: shouldMarkPermanent
                ? "permanentFailed"
                : "retryableFailed",
              updatedAt: now,
            }
          )}
            WHERE ${column(notificationDeliveryColumns, "id")} = ${delivery.id}`;

          if (delivery.notificationEndpointId) {
            yield* sql`UPDATE ${table("notificationEndpoint")} SET ${updateRow(
              sql,
              notificationEndpointColumns,
              {
                lastError: message,
                lastErrorAt: now,
                updatedAt: now,
              }
            )}
              WHERE ${column(notificationEndpointColumns, "id")} = ${delivery.notificationEndpointId}`;
          }

          if (delivery.pushSubscriptionId) {
            if (shouldDeactivateSubscription) {
              yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
                sql,
                pushSubscriptionColumns,
                {
                  isActive: false,
                  lastError: message,
                  updatedAt: now,
                }
              )}
                WHERE ${column(pushSubscriptionColumns, "id")} = ${delivery.pushSubscriptionId}`;
            } else {
              yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
                sql,
                pushSubscriptionColumns,
                {
                  lastError: message,
                  updatedAt: now,
                }
              )}
                WHERE ${column(pushSubscriptionColumns, "id")} = ${delivery.pushSubscriptionId}`;
            }
          }
        })
      );
    })
  );
};
