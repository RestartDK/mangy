import { z } from "zod";

export const destinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  absolutePath: z.string(),
  komgaLibraryId: z.string().nullable(),
  isDefault: z.boolean(),
  isEnabled: z.boolean(),
});

export const destinationParamsSchema = z.object({
  destinationId: z.string(),
});

export const deleteDestinationResponseSchema = z.object({
  id: z.string(),
});

export const createDestinationBody = z.object({
  name: z.string().trim().min(1).max(120),
  absolutePath: z.string().trim().min(1),
  komgaLibraryId: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
});

export const settingsBootstrapSchema = z.object({
  profile: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  destinations: z.array(destinationSchema),
  notifications: z.object({
    inAppEnabled: z.boolean(),
    unreadCount: z.number().int(),
  }),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
