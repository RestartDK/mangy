import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  NotificationDeliveryIdSchema,
  NotificationEndpointIdSchema,
  NotificationIdSchema,
  PushSubscriptionIdSchema,
} from "./ids";

export const notificationDeliveryTable = "notification_delivery";

export class NotificationDelivery extends Model.Class<NotificationDelivery>(
  "NotificationDelivery"
)({
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
}) {}

export const notificationDeliveryColumns = {
  attempts: "attempts",
  channel: "channel",
  createdAt: "created_at",
  deliveredAt: "delivered_at",
  id: "id",
  lastError: "last_error",
  leaseOwner: "lease_owner",
  leasedAt: "leased_at",
  maxAttempts: "max_attempts",
  nextAttemptAt: "next_attempt_at",
  notificationEndpointId: "notification_endpoint_id",
  notificationId: "notification_id",
  pushSubscriptionId: "push_subscription_id",
  status: "status",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof NotificationDelivery.fields, string>;
