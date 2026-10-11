import { Schema } from "effect";
import { Model } from "effect/schema";

import { PushSubscriptionIdSchema, UserIdSchema } from "./ids";

export const pushSubscriptionTable = "push_subscription";

export class PushSubscription extends Model.Class<PushSubscription>(
  "PushSubscription"
)({
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
}) {}

export const pushSubscriptionColumns = {
  auth: "auth",
  createdAt: "created_at",
  endpoint: "endpoint",
  expirationTime: "expiration_time",
  id: "id",
  isActive: "is_active",
  lastError: "last_error",
  lastSeenAt: "last_seen_at",
  p256dh: "p256dh",
  updatedAt: "updated_at",
  userAgent: "user_agent",
  userId: "user_id",
} as const satisfies Record<keyof typeof PushSubscription.fields, string>;
