import { z } from "zod";

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum([
    "downloadCompleted",
    "downloadFailed",
    "trackedSeriesUpdated",
    "systemWarning",
  ]),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
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
