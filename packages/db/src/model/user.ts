import { Schema } from "effect";
import { Model } from "effect/schema";

import { UserIdSchema } from "./ids";

export const userTable = "user";

export class User extends Model.Class<User>("User")({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: UserIdSchema,
  image: Schema.OptionFromNullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
}) {}

export const userColumns = {
  createdAt: "created_at",
  email: "email",
  emailVerified: "email_verified",
  id: "id",
  image: "image",
  name: "name",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof User.fields, string>;
