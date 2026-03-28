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

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
