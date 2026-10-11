import { Schema } from "effect";
import { Model } from "effect/schema";

import { AccountIdSchema, UserIdSchema } from "./ids";

export const accountTable = "account";

export class Account extends Model.Class<Account>("Account")({
  accessToken: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.NullOr(Schema.Date),
  accountId: Schema.String,
  createdAt: Schema.Date,
  id: AccountIdSchema,
  idToken: Schema.NullOr(Schema.String),
  password: Schema.NullOr(Schema.String),
  providerId: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  refreshTokenExpiresAt: Schema.NullOr(Schema.Date),
  scope: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}) {}

export const accountColumns = {
  accessToken: "access_token",
  accessTokenExpiresAt: "access_token_expires_at",
  accountId: "account_id",
  createdAt: "created_at",
  id: "id",
  idToken: "id_token",
  password: "password",
  providerId: "provider_id",
  refreshToken: "refresh_token",
  refreshTokenExpiresAt: "refresh_token_expires_at",
  scope: "scope",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof Account.fields, string>;
