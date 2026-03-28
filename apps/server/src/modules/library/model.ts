import { z } from "zod";

export const libraryItemSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  seriesId: z.string(),
  title: z.string(),
  coverImageUrl: z.string().url().nullable(),
  isTracked: z.boolean(),
  autoDownload: z.boolean(),
  destinationName: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
