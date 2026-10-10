import { Schema } from "effect";

import { fieldColumns } from "./columns";
import {
  NotificationDeliveryIdSchema,
  NotificationEndpointIdSchema,
  NotificationIdSchema,
  PushSubscriptionIdSchema,
  UserIdSchema,
} from "./ids";

export const notificationEndpointTable = "notification_endpoint";
export const notificationEndpointRow = Schema.Struct({
  createdAt: Schema.Date,
  id: NotificationEndpointIdSchema,
  isEnabled: Schema.Boolean,
  lastDeliveredAt: Schema.NullOr(Schema.Date),
  lastError: Schema.NullOr(Schema.String),
  lastErrorAt: Schema.NullOr(Schema.Date),
  maskedValue: Schema.NullOr(Schema.String),
  notifyOnDownloadCompleted: Schema.Boolean,
  notifyOnDownloadFailed: Schema.Boolean,
  notifyOnSystemWarning: Schema.Boolean,
  notifyOnTrackedSeriesUpdate: Schema.Boolean,
  type: Schema.Literals(["inApp", "slack", "browserPush"]),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    isEnabled: "is_enabled",
    lastDeliveredAt: "last_delivered_at",
    lastError: "last_error",
    lastErrorAt: "last_error_at",
    maskedValue: "masked_value",
    notifyOnDownloadCompleted: "notify_on_download_completed",
    notifyOnDownloadFailed: "notify_on_download_failed",
    notifyOnSystemWarning: "notify_on_system_warning",
    notifyOnTrackedSeriesUpdate: "notify_on_tracked_series_update",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const notificationEndpointColumns = fieldColumns(
  notificationEndpointRow
);

export const pushSubscriptionTable = "push_subscription";
export const pushSubscriptionRow = Schema.Struct({
  auth: Schema.String,
  createdAt: Schema.Date,
  endpoint: Schema.String,
  expirationTime: Schema.NullOr(Schema.Date),
  id: PushSubscriptionIdSchema,
  isActive: Schema.Boolean,
  lastError: Schema.NullOr(Schema.String),
  lastSeenAt: Schema.Date,
  p256dh: Schema.String,
  updatedAt: Schema.Date,
  userAgent: Schema.NullOr(Schema.String),
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    expirationTime: "expiration_time",
    isActive: "is_active",
    lastError: "last_error",
    lastSeenAt: "last_seen_at",
    updatedAt: "updated_at",
    userAgent: "user_agent",
    userId: "user_id",
  })
);
export const pushSubscriptionColumns = fieldColumns(pushSubscriptionRow);

export const notificationTable = "notification";
export const notificationRow = Schema.Struct({
  body: Schema.String,
  createdAt: Schema.Date,
  id: NotificationIdSchema,
  isRead: Schema.Boolean,
  title: Schema.String,
  type: Schema.Literals([
    "downloadCompleted",
    "downloadFailed",
    "trackedSeriesUpdated",
    "systemWarning",
  ]),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    isRead: "is_read",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const notificationColumns = fieldColumns(notificationRow);

export const notificationDeliveryTable = "notification_delivery";
export const notificationDeliveryRow = Schema.Struct({
  attempts: Schema.Int,
  channel: Schema.Literals(["browserPush", "slack"]),
  createdAt: Schema.Date,
  deliveredAt: Schema.NullOr(Schema.Date),
  id: NotificationDeliveryIdSchema,
  lastError: Schema.NullOr(Schema.String),
  leaseOwner: Schema.NullOr(Schema.String),
  leasedAt: Schema.NullOr(Schema.Date),
  maxAttempts: Schema.Int,
  nextAttemptAt: Schema.Date,
  notificationEndpointId: Schema.NullOr(NotificationEndpointIdSchema),
  notificationId: NotificationIdSchema,
  pushSubscriptionId: Schema.NullOr(PushSubscriptionIdSchema),
  status: Schema.Literals([
    "queued",
    "running",
    "retryableFailed",
    "delivered",
    "permanentFailed",
  ]),
  updatedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    deliveredAt: "delivered_at",
    lastError: "last_error",
    leaseOwner: "lease_owner",
    leasedAt: "leased_at",
    maxAttempts: "max_attempts",
    nextAttemptAt: "next_attempt_at",
    notificationEndpointId: "notification_endpoint_id",
    notificationId: "notification_id",
    pushSubscriptionId: "push_subscription_id",
    updatedAt: "updated_at",
  })
);
export const notificationDeliveryColumns = fieldColumns(
  notificationDeliveryRow
);
