import { Schema } from "effect";
import { Model } from "effect/schema";

import { SessionIdSchema, UserIdSchema } from "./ids";

export const sessionTable = "session";

export class Session extends Model.Class<Session>("Session")({
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
  id: SessionIdSchema,
  ipAddress: Schema.NullOr(Schema.String),
  token: Schema.String,
  updatedAt: Schema.Date,
  userAgent: Schema.NullOr(Schema.String),
  userId: UserIdSchema,
}) {}

export const sessionColumns = {
  createdAt: "created_at",
  expiresAt: "expires_at",
  id: "id",
  ipAddress: "ip_address",
  token: "token",
  updatedAt: "updated_at",
  userAgent: "user_agent",
  userId: "user_id",
} as const satisfies Record<keyof typeof Session.fields, string>;
