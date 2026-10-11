import { z } from "zod";

export const notificationSchema = z.object({
  body: z.string(),
  createdAt: z.iso.datetime(),
  id: z.string(),
  isRead: z.boolean(),
  title: z.string(),
  type: z.enum([
    "downloadCompleted",
    "downloadFailed",
    "trackedSeriesUpdated",
    "systemWarning",
  ]),
});

export const notificationParamsSchema = z.object({
  notificationId: z.string(),
});

export const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  unreadCount: z.number().int(),
});

export const updateNotificationPreferencesBody = z.object({
  inAppEnabled: z.boolean(),
});

export const markAllNotificationsReadSchema = z.object({
  updatedCount: z.number().int(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
