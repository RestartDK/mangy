import { z } from "zod";

export const destinationSchema = z.object({
  absolutePath: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  isEnabled: z.boolean(),
  komgaLibraryId: z.string().nullable(),
  name: z.string(),
});

export const destinationParamsSchema = z.object({
  destinationId: z.string(),
});

export const deleteDestinationResponseSchema = z.object({
  id: z.string(),
});

export const createDestinationBody = z.object({
  absolutePath: z.string().trim().min(1),
  isDefault: z.boolean().optional(),
  komgaLibraryId: z.string().trim().optional(),
  name: z.string().trim().min(1).max(120),
});

export const settingsBootstrapSchema = z.object({
  destinations: z.array(destinationSchema),
  notifications: z.object({
    inAppEnabled: z.boolean(),
    unreadCount: z.number().int(),
  }),
  profile: z.object({
    email: z.string().email(),
    name: z.string(),
  }),
});

export const browserPushSettingsSchema = z.object({
  activeSubscriptionCount: z.number().int(),
  isConfigured: z.boolean(),
  isEnabled: z.boolean(),
  lastDeliveredAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: z.string().datetime().nullable(),
  notifyOnDownloadCompleted: z.boolean(),
  notifyOnDownloadFailed: z.boolean(),
  notifyOnTrackedSeriesUpdate: z.boolean(),
  notifyOnSystemWarning: z.boolean(),
  vapidPublicKey: z.string().nullable(),
});

export const updateBrowserPushPreferencesBody = z.object({
  isEnabled: z.boolean(),
  notifyOnDownloadCompleted: z.boolean(),
  notifyOnDownloadFailed: z.boolean(),
  notifyOnTrackedSeriesUpdate: z.boolean(),
  notifyOnSystemWarning: z.boolean(),
});

export const savePushSubscriptionBody = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().finite().nullable().optional(),
  keys: z.object({
    auth: z.string().trim().min(1),
    p256dh: z.string().trim().min(1),
  }),
  userAgent: z.string().trim().optional(),
});

export const removePushSubscriptionBody = z.object({
  endpoint: z.string().url(),
});

export const browserPushTestResponseSchema = z.object({
  deliveredCount: z.number().int().nonnegative(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
