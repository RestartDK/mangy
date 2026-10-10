import { Schema } from "effect";

import { defineTable } from "./table";

export const {
  row: notificationEndpointRow,
  columns: notificationEndpointColumns,
  table: notificationEndpointTable,
} = defineTable("notification_endpoint", {
  createdAt: { column: "created_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  isEnabled: { column: "is_enabled", schema: Schema.Boolean },
  lastDeliveredAt: {
    column: "last_delivered_at",
    nullable: true,
    schema: Schema.Date,
  },
  lastError: { column: "last_error", nullable: true, schema: Schema.String },
  lastErrorAt: { column: "last_error_at", nullable: true, schema: Schema.Date },
  maskedValue: {
    column: "masked_value",
    nullable: true,
    schema: Schema.String,
  },
  notifyOnDownloadCompleted: {
    column: "notify_on_download_completed",
    schema: Schema.Boolean,
  },
  notifyOnDownloadFailed: {
    column: "notify_on_download_failed",
    schema: Schema.Boolean,
  },
  notifyOnSystemWarning: {
    column: "notify_on_system_warning",
    schema: Schema.Boolean,
  },
  notifyOnTrackedSeriesUpdate: {
    column: "notify_on_tracked_series_update",
    schema: Schema.Boolean,
  },
  type: {
    column: "type",
    schema: Schema.Literals(["inApp", "slack", "browserPush"]),
  },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: pushSubscriptionRow,
  columns: pushSubscriptionColumns,
  table: pushSubscriptionTable,
} = defineTable("push_subscription", {
  auth: { column: "auth", schema: Schema.String },
  createdAt: { column: "created_at", schema: Schema.Date },
  endpoint: { column: "endpoint", schema: Schema.String },
  expirationTime: {
    column: "expiration_time",
    nullable: true,
    schema: Schema.Date,
  },
  id: { column: "id", schema: Schema.String },
  isActive: { column: "is_active", schema: Schema.Boolean },
  lastError: { column: "last_error", nullable: true, schema: Schema.String },
  lastSeenAt: { column: "last_seen_at", schema: Schema.Date },
  p256dh: { column: "p256dh", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userAgent: { column: "user_agent", nullable: true, schema: Schema.String },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: notificationRow,
  columns: notificationColumns,
  table: notificationTable,
} = defineTable("notification", {
  body: { column: "body", schema: Schema.String },
  createdAt: { column: "created_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  isRead: { column: "is_read", schema: Schema.Boolean },
  title: { column: "title", schema: Schema.String },
  type: {
    column: "type",
    schema: Schema.Literals([
      "downloadCompleted",
      "downloadFailed",
      "trackedSeriesUpdated",
      "systemWarning",
    ]),
  },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: notificationDeliveryRow,
  columns: notificationDeliveryColumns,
  table: notificationDeliveryTable,
} = defineTable("notification_delivery", {
  attempts: { column: "attempts", schema: Schema.Int },
  channel: {
    column: "channel",
    schema: Schema.Literals(["browserPush", "slack"]),
  },
  createdAt: { column: "created_at", schema: Schema.Date },
  deliveredAt: { column: "delivered_at", nullable: true, schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  lastError: { column: "last_error", nullable: true, schema: Schema.String },
  leaseOwner: { column: "lease_owner", nullable: true, schema: Schema.String },
  leasedAt: { column: "leased_at", nullable: true, schema: Schema.Date },
  maxAttempts: { column: "max_attempts", schema: Schema.Int },
  nextAttemptAt: { column: "next_attempt_at", schema: Schema.Date },
  notificationEndpointId: {
    column: "notification_endpoint_id",
    nullable: true,
    schema: Schema.String,
  },
  notificationId: { column: "notification_id", schema: Schema.String },
  pushSubscriptionId: {
    column: "push_subscription_id",
    nullable: true,
    schema: Schema.String,
  },
  status: {
    column: "status",
    schema: Schema.Literals([
      "queued",
      "running",
      "retryableFailed",
      "delivered",
      "permanentFailed",
    ]),
  },
  updatedAt: { column: "updated_at", schema: Schema.Date },
});
