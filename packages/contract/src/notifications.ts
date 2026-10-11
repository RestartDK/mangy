import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import { isoDateTimeString } from "./timestamps";

export const notificationSchema = Schema.Struct({
  body: Schema.String,
  createdAt: isoDateTimeString,
  id: Schema.String,
  isRead: Schema.Boolean,
  title: Schema.String,
  type: Schema.Literals([
    "downloadCompleted",
    "downloadFailed",
    "trackedSeriesUpdated",
    "systemWarning",
  ]),
});
export type Notification = typeof notificationSchema.Type;

export const notificationPreferencesSchema = Schema.Struct({
  inAppEnabled: Schema.Boolean,
  unreadCount: Schema.Int,
});
export type NotificationPreferences = typeof notificationPreferencesSchema.Type;

export const notificationParamsSchema = Schema.Struct({
  notificationId: Schema.String,
});

export type NotificationParams = typeof notificationParamsSchema.Type;

export const updateNotificationPreferencesBody = Schema.Struct({
  inAppEnabled: Schema.Boolean,
});
export type UpdateNotificationPreferences =
  typeof updateNotificationPreferencesBody.Type;

export const markAllNotificationsReadSchema = Schema.Struct({
  updatedCount: Schema.Int,
});

export const NotificationsApi = HttpApiGroup.make("notifications")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(notificationSchema),
    }),
    HttpApiEndpoint.get("getPreferences", "/preferences", {
      error: [Unauthorized],
      success: notificationPreferencesSchema,
    }),
    HttpApiEndpoint.patch("updatePreferences", "/preferences", {
      error: [Unauthorized],
      payload: updateNotificationPreferencesBody,
      success: notificationPreferencesSchema,
    }),
    HttpApiEndpoint.patch("markRead", "/:notificationId/read", {
      error: [Unauthorized, BadRequest],
      params: notificationParamsSchema,
      success: notificationSchema,
    }),
    HttpApiEndpoint.post("markAllRead", "/mark-all-read", {
      error: [Unauthorized],
      success: markAllNotificationsReadSchema,
    })
  )
  .prefix("/api/notifications");
