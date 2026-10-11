import { Schema } from "effect";
import { Model } from "effect/schema";

import { VerificationIdSchema } from "./ids";

export const verificationTable = "verification";

export class Verification extends Model.Class<Verification>("Verification")({
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
  id: VerificationIdSchema,
  identifier: Schema.String,
  updatedAt: Schema.Date,
  value: Schema.String,
}) {}

export const verificationColumns = {
  createdAt: "created_at",
  expiresAt: "expires_at",
  id: "id",
  identifier: "identifier",
  updatedAt: "updated_at",
  value: "value",
} as const satisfies Record<keyof typeof Verification.fields, string>;
