import { Schema } from "effect";
import { Model } from "effect/schema";

import { NotificationEndpointIdSchema, UserIdSchema } from "./ids";

export const notificationEndpointTable = "notification_endpoint";

export class NotificationEndpoint extends Model.Class<NotificationEndpoint>(
  "NotificationEndpoint"
)({
  createdAt: Schema.Date,
  id: NotificationEndpointIdSchema,
  isEnabled: Schema.Boolean,
  lastDeliveredAt: Schema.OptionFromNullOr(Schema.Date),
  lastError: Schema.OptionFromNullOr(Schema.String),
  lastErrorAt: Schema.OptionFromNullOr(Schema.Date),
  maskedValue: Schema.OptionFromNullOr(Schema.String),
  notifyOnDownloadCompleted: Schema.Boolean,
  notifyOnDownloadFailed: Schema.Boolean,
  notifyOnSystemWarning: Schema.Boolean,
  notifyOnTrackedSeriesUpdate: Schema.Boolean,
  type: Schema.Literals(["inApp", "slack", "browserPush"]),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}) {}

export const notificationEndpointColumns = {
  createdAt: "created_at",
  id: "id",
  isEnabled: "is_enabled",
  lastDeliveredAt: "last_delivered_at",
  lastError: "last_error",
  lastErrorAt: "last_error_at",
  maskedValue: "masked_value",
  notifyOnDownloadCompleted: "notify_on_download_completed",
  notifyOnDownloadFailed: "notify_on_download_failed",
  notifyOnSystemWarning: "notify_on_system_warning",
  notifyOnTrackedSeriesUpdate: "notify_on_tracked_series_update",
  type: "type",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof NotificationEndpoint.fields, string>;
