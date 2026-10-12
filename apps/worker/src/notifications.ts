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
  NotificationDelivery,
  NotificationEndpoint,
  PushSubscription,
  notificationColumns,
  notificationDeliveryColumns,
  notificationEndpointColumns,
  pushSubscriptionColumns,
} from "@mangy/db/model";
import type { UserId } from "@mangy/db/model";
import { BrowserPushError, sendBrowserPush } from "@mangy/push";
import type { BrowserPushPayload } from "@mangy/push";
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

type NotificationType = Schema.Schema.Type<typeof Notification.fields.type>;

interface BrowserPushEndpointRecord {
  id: string;
  isEnabled: boolean;
  notifyOnDownloadCompleted: boolean;
  notifyOnDownloadFailed: boolean;
  notifyOnTrackedSeriesUpdate: boolean;
  notifyOnSystemWarning: boolean;
}

export type ClaimedPushDelivery = Schema.Schema.Type<
  typeof claimedPushDeliveryProjection
>;

const claimedPushDeliveryProjection = Schema.Struct({
  attempts: NotificationDelivery.fields.attempts,
  id: NotificationDelivery.fields.id,
  maxAttempts: NotificationDelivery.fields.maxAttempts,
  notificationBody: Notification.fields.body,
  notificationEndpointId: NotificationDelivery.fields.notificationEndpointId,
  notificationId: Notification.fields.id,
  notificationTitle: Notification.fields.title,
  notificationType: Notification.fields.type,
  pushSubscriptionAuth: Schema.OptionFromNullOr(PushSubscription.fields.auth),
  pushSubscriptionEndpoint: Schema.OptionFromNullOr(
    PushSubscription.fields.endpoint
  ),
  pushSubscriptionId: Schema.OptionFromNullOr(PushSubscription.fields.id),
  pushSubscriptionP256dh: Schema.OptionFromNullOr(
    PushSubscription.fields.p256dh
  ),
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

const getRetryDelayMs = (attempts: number): number =>
  15_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 4);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to deliver this browser notification.";
};

export const queueNotification = (input: {
  body: string;
  title: string;
  type: NotificationType;
  userId: UserId;
}) =>
  Effect.gen(function* createNotificationRecordEffect() {
    const sql = yield* SqlClient.SqlClient;
    const created = yield* decodeRows(
      Schema.Struct({ id: Notification.fields.id }),
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
        id: NotificationEndpoint.fields.id,
        is_enabled: NotificationEndpoint.fields.isEnabled,
        notify_on_download_completed:
          NotificationEndpoint.fields.notifyOnDownloadCompleted,
        notify_on_download_failed:
          NotificationEndpoint.fields.notifyOnDownloadFailed,
        notify_on_system_warning:
          NotificationEndpoint.fields.notifyOnSystemWarning,
        notify_on_tracked_series_update:
          NotificationEndpoint.fields.notifyOnTrackedSeriesUpdate,
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
      Schema.Struct({ id: PushSubscription.fields.id }),
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
        channel: "browserPush" as const,
        id: crypto.randomUUID(),
        notificationEndpointId: browserPushEndpoint.id,
        notificationId: createdNotification.id,
        pushSubscriptionId: subscription.id,
      }))
    )}`;
  });

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

  if (claimedDeliveryId === null || claimedDeliveryId.length === 0) {
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
  const pushSubscription = Option.all({
    auth: delivery.pushSubscriptionAuth,
    endpoint: delivery.pushSubscriptionEndpoint,
    p256dh: delivery.pushSubscriptionP256dh,
  });

  if (Option.isNone(pushSubscription)) {
    throw new BrowserPushError(
      "This browser subscription is no longer valid.",
      {
        permanent: true,
      }
    );
  }

  await sendBrowserPush(
    {
      endpoint: pushSubscription.value.endpoint,
      keys: {
        auth: pushSubscription.value.auth,
        p256dh: pushSubscription.value.p256dh,
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

          if (Option.isSome(delivery.notificationEndpointId)) {
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
              WHERE ${column(notificationEndpointColumns, "id")} = ${delivery.notificationEndpointId.value}`;
          }

          if (Option.isSome(delivery.pushSubscriptionId)) {
            yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
              sql,
              pushSubscriptionColumns,
              {
                lastError: null,
                lastSeenAt: now,
                updatedAt: now,
              }
            )}
              WHERE ${column(pushSubscriptionColumns, "id")} = ${delivery.pushSubscriptionId.value}`;
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

          if (Option.isSome(delivery.notificationEndpointId)) {
            yield* sql`UPDATE ${table("notificationEndpoint")} SET ${updateRow(
              sql,
              notificationEndpointColumns,
              {
                lastError: message,
                lastErrorAt: now,
                updatedAt: now,
              }
            )}
              WHERE ${column(notificationEndpointColumns, "id")} = ${delivery.notificationEndpointId.value}`;
          }

          if (Option.isSome(delivery.pushSubscriptionId)) {
            const subscriptionValues = shouldDeactivateSubscription
              ? { isActive: false, lastError: message, updatedAt: now }
              : { lastError: message, updatedAt: now };

            yield* sql`UPDATE ${table("pushSubscription")} SET ${updateRow(
              sql,
              pushSubscriptionColumns,
              subscriptionValues
            )}
              WHERE ${column(pushSubscriptionColumns, "id")} = ${delivery.pushSubscriptionId.value}`;
          }
        })
      );
    })
  );
};
