import { db } from "@mangy/db";
import {
  notification,
  notificationDelivery,
  notificationEndpoint,
  pushSubscription,
} from "@mangy/db/schema";
import {
  BrowserPushError,
  type BrowserPushPayload,
  sendBrowserPush,
} from "@mangy/push";
import { and, eq, sql } from "drizzle-orm";

type NotificationType = (typeof notification.$inferSelect)["type"];
type DatabaseClient = Pick<typeof db, "insert" | "select" | "update">;

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

const createNotificationRecord = async (
  database: DatabaseClient,
  input: {
    body: string;
    title: string;
    type: NotificationType;
    userId: string;
  }
): Promise<void> => {
  const [createdNotification] = await database
    .insert(notification)
    .values(input)
    .returning({ id: notification.id });

  if (!createdNotification) {
    throw new Error("Unable to create this notification.");
  }

  const [browserPushEndpoint] = await database
    .select({
      id: notificationEndpoint.id,
      isEnabled: notificationEndpoint.isEnabled,
      notifyOnDownloadCompleted: notificationEndpoint.notifyOnDownloadCompleted,
      notifyOnDownloadFailed: notificationEndpoint.notifyOnDownloadFailed,
      notifyOnTrackedSeriesUpdate:
        notificationEndpoint.notifyOnTrackedSeriesUpdate,
      notifyOnSystemWarning: notificationEndpoint.notifyOnSystemWarning,
    })
    .from(notificationEndpoint)
    .where(
      and(
        eq(notificationEndpoint.userId, input.userId),
        eq(notificationEndpoint.type, "browserPush")
      )
    )
    .limit(1);

  if (!browserPushEndpoint) {
    return;
  }

  if (!shouldSendBrowserPush(browserPushEndpoint, input.type)) {
    return;
  }

  const subscriptions = await database
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, input.userId),
        eq(pushSubscription.isActive, true)
      )
    );

  if (subscriptions.length === 0) {
    return;
  }

  await database.insert(notificationDelivery).values(
    subscriptions.map((subscription) => ({
      channel: "browserPush" as const,
      notificationEndpointId: browserPushEndpoint.id,
      notificationId: createdNotification.id,
      pushSubscriptionId: subscription.id,
    }))
  );
};

export const queueNotificationForTransaction = async (
  transaction: DatabaseClient,
  input: {
    body: string;
    title: string;
    type: NotificationType;
    userId: string;
  }
): Promise<void> => {
  await createNotificationRecord(transaction, input);
};

export const emitNotification = async (input: {
  body: string;
  title: string;
  type: NotificationType;
  userId: string;
}): Promise<void> => {
  await db.transaction(async (tx) => {
    await createNotificationRecord(tx, input);
  });
};

export const claimNextPushDelivery = async (
  workerId: string
): Promise<ClaimedPushDelivery | null> => {
  const result = await db.execute(sql<{ id: string }>`
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
  `);

  const claimedDeliveryId = result.rows[0]?.id as string | undefined;
  if (!claimedDeliveryId) {
    return null;
  }

  const [delivery] = await db
    .select({
      attempts: notificationDelivery.attempts,
      id: notificationDelivery.id,
      maxAttempts: notificationDelivery.maxAttempts,
      notificationBody: notification.body,
      notificationEndpointId: notificationDelivery.notificationEndpointId,
      notificationId: notification.id,
      notificationTitle: notification.title,
      notificationType: notification.type,
      pushSubscriptionAuth: pushSubscription.auth,
      pushSubscriptionEndpoint: pushSubscription.endpoint,
      pushSubscriptionId: pushSubscription.id,
      pushSubscriptionP256dh: pushSubscription.p256dh,
    })
    .from(notificationDelivery)
    .innerJoin(
      notification,
      eq(notificationDelivery.notificationId, notification.id)
    )
    .leftJoin(
      pushSubscription,
      eq(notificationDelivery.pushSubscriptionId, pushSubscription.id)
    )
    .where(eq(notificationDelivery.id, claimedDeliveryId))
    .limit(1);

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

  await db.transaction(async (tx) => {
    await tx
      .update(notificationDelivery)
      .set({
        deliveredAt: now,
        lastError: null,
        leaseOwner: null,
        leasedAt: null,
        status: "delivered",
        updatedAt: now,
      })
      .where(eq(notificationDelivery.id, delivery.id));

    if (delivery.notificationEndpointId) {
      await tx
        .update(notificationEndpoint)
        .set({
          lastDeliveredAt: now,
          lastError: null,
          lastErrorAt: null,
          updatedAt: now,
        })
        .where(eq(notificationEndpoint.id, delivery.notificationEndpointId));
    }

    if (delivery.pushSubscriptionId) {
      await tx
        .update(pushSubscription)
        .set({
          lastError: null,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(pushSubscription.id, delivery.pushSubscriptionId));
    }
  });
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

  await db.transaction(async (tx) => {
    await tx
      .update(notificationDelivery)
      .set({
        lastError: message,
        leaseOwner: null,
        leasedAt: null,
        nextAttemptAt: new Date(
          now.getTime() + getRetryDelayMs(delivery.attempts)
        ),
        status: shouldMarkPermanent ? "permanentFailed" : "retryableFailed",
        updatedAt: now,
      })
      .where(eq(notificationDelivery.id, delivery.id));

    if (delivery.notificationEndpointId) {
      await tx
        .update(notificationEndpoint)
        .set({
          lastError: message,
          lastErrorAt: now,
          updatedAt: now,
        })
        .where(eq(notificationEndpoint.id, delivery.notificationEndpointId));
    }

    if (delivery.pushSubscriptionId) {
      if (shouldDeactivateSubscription) {
        await tx
          .update(pushSubscription)
          .set({
            isActive: false,
            lastError: message,
            updatedAt: now,
          })
          .where(eq(pushSubscription.id, delivery.pushSubscriptionId));
      } else {
        await tx
          .update(pushSubscription)
          .set({
            lastError: message,
            updatedAt: now,
          })
          .where(eq(pushSubscription.id, delivery.pushSubscriptionId));
      }
    }
  });
};
