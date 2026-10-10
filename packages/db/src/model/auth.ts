import { Schema } from "effect";

import { defineTable } from "./table";

export const { row: userRow, columns: userColumns } = defineTable({
  createdAt: { column: "created_at", schema: Schema.Date },
  email: { column: "email", schema: Schema.String },
  emailVerified: { column: "email_verified", schema: Schema.Boolean },
  id: { column: "id", schema: Schema.String },
  image: { column: "image", nullable: true, schema: Schema.String },
  name: { column: "name", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
});

export const { row: sessionRow, columns: sessionColumns } = defineTable({
  createdAt: { column: "created_at", schema: Schema.Date },
  expiresAt: { column: "expires_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  ipAddress: { column: "ip_address", nullable: true, schema: Schema.String },
  token: { column: "token", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userAgent: { column: "user_agent", nullable: true, schema: Schema.String },
  userId: { column: "user_id", schema: Schema.String },
});

export const { row: accountRow, columns: accountColumns } = defineTable({
  accessToken: {
    column: "access_token",
    nullable: true,
    schema: Schema.String,
  },
  accessTokenExpiresAt: {
    column: "access_token_expires_at",
    nullable: true,
    schema: Schema.Date,
  },
  accountId: { column: "account_id", schema: Schema.String },
  createdAt: { column: "created_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  idToken: { column: "id_token", nullable: true, schema: Schema.String },
  password: { column: "password", nullable: true, schema: Schema.String },
  providerId: { column: "provider_id", schema: Schema.String },
  refreshToken: {
    column: "refresh_token",
    nullable: true,
    schema: Schema.String,
  },
  refreshTokenExpiresAt: {
    column: "refresh_token_expires_at",
    nullable: true,
    schema: Schema.Date,
  },
  scope: { column: "scope", nullable: true, schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const { row: verificationRow, columns: verificationColumns } =
  defineTable({
    createdAt: { column: "created_at", schema: Schema.Date },
    expiresAt: { column: "expires_at", schema: Schema.Date },
    id: { column: "id", schema: Schema.String },
    identifier: { column: "identifier", schema: Schema.String },
    updatedAt: { column: "updated_at", schema: Schema.Date },
    value: { column: "value", schema: Schema.String },
  });
