import { Schema } from "effect";
import { Model } from "effect/schema";

import { ApiKeyIdSchema, UserIdSchema } from "./ids";

/** better-auth's api-key plugin addresses this table by its model name. */
export const apiKeyTable = "apikey";

export class ApiKey extends Model.Class<ApiKey>("ApiKey")({
  configId: Schema.String,
  createdAt: Schema.Date,
  enabled: Schema.Boolean,
  expiresAt: Schema.OptionFromNullOr(Schema.Date),
  id: ApiKeyIdSchema,
  key: Schema.String,
  lastRefillAt: Schema.OptionFromNullOr(Schema.Date),
  lastRequest: Schema.OptionFromNullOr(Schema.Date),
  metadata: Schema.OptionFromNullOr(Schema.Unknown),
  name: Schema.OptionFromNullOr(Schema.String),
  permissions: Schema.OptionFromNullOr(Schema.String),
  prefix: Schema.OptionFromNullOr(Schema.String),
  rateLimitEnabled: Schema.Boolean,
  rateLimitMax: Schema.OptionFromNullOr(Schema.Finite),
  rateLimitTimeWindow: Schema.OptionFromNullOr(Schema.Finite),
  referenceId: UserIdSchema,
  refillAmount: Schema.OptionFromNullOr(Schema.Finite),
  refillInterval: Schema.OptionFromNullOr(Schema.Finite),
  remaining: Schema.OptionFromNullOr(Schema.Finite),
  requestCount: Schema.Finite,
  start: Schema.OptionFromNullOr(Schema.String),
  updatedAt: Schema.Date,
}) {}

export const apiKeyColumns = {
  configId: "config_id",
  createdAt: "created_at",
  enabled: "enabled",
  expiresAt: "expires_at",
  id: "id",
  key: "key",
  lastRefillAt: "last_refill_at",
  lastRequest: "last_request",
  metadata: "metadata",
  name: "name",
  permissions: "permissions",
  prefix: "prefix",
  rateLimitEnabled: "rate_limit_enabled",
  rateLimitMax: "rate_limit_max",
  rateLimitTimeWindow: "rate_limit_time_window",
  referenceId: "reference_id",
  refillAmount: "refill_amount",
  refillInterval: "refill_interval",
  remaining: "remaining",
  requestCount: "request_count",
  start: "start",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof ApiKey.fields, string>;
