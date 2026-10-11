import { Schema } from "effect";

import { fieldColumns } from "./columns";
import {
  AccountIdSchema,
  SessionIdSchema,
  UserIdSchema,
  VerificationIdSchema,
} from "./ids";

export const userRow = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: UserIdSchema,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    emailVerified: "email_verified",
    updatedAt: "updated_at",
  })
);
export const userColumns = fieldColumns(userRow);

export const sessionRow = Schema.Struct({
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
  id: SessionIdSchema,
  ipAddress: Schema.NullOr(Schema.String),
  token: Schema.String,
  updatedAt: Schema.Date,
  userAgent: Schema.NullOr(Schema.String),
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    expiresAt: "expires_at",
    ipAddress: "ip_address",
    updatedAt: "updated_at",
    userAgent: "user_agent",
    userId: "user_id",
  })
);
export const sessionColumns = fieldColumns(sessionRow);

export const accountRow = Schema.Struct({
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
}).pipe(
  Schema.encodeKeys({
    accessToken: "access_token",
    accessTokenExpiresAt: "access_token_expires_at",
    accountId: "account_id",
    createdAt: "created_at",
    idToken: "id_token",
    providerId: "provider_id",
    refreshToken: "refresh_token",
    refreshTokenExpiresAt: "refresh_token_expires_at",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const accountColumns = fieldColumns(accountRow);

export const verificationRow = Schema.Struct({
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
  id: VerificationIdSchema,
  identifier: Schema.String,
  updatedAt: Schema.Date,
  value: Schema.String,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    expiresAt: "expires_at",
    updatedAt: "updated_at",
  })
);
export const verificationColumns = fieldColumns(verificationRow);
