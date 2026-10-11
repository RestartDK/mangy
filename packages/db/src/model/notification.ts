import { Schema } from "effect";
import { Model } from "effect/schema";

import { NotificationIdSchema, UserIdSchema } from "./ids";

export const notificationTable = "notification";

export class Notification extends Model.Class<Notification>("Notification")({
  body: Schema.String,
  createdAt: Schema.Date,
  id: NotificationIdSchema,
  isRead: Schema.Boolean,
  title: Schema.String,
  type: Schema.Literals([
    "downloadCompleted",
    "downloadFailed",
    "trackedSeriesUpdated",
    "systemWarning",
  ]),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}) {}

export const notificationColumns = {
  body: "body",
  createdAt: "created_at",
  id: "id",
  isRead: "is_read",
  title: "title",
  type: "type",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof Notification.fields, string>;

export const notificationRow = Notification.pipe(
  Schema.encodeKeys(notificationColumns)
);
