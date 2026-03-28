import { z } from "zod";

export const trackedSeriesSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  seriesId: z.string(),
  title: z.string(),
  nextCheckAt: z.string().datetime().nullable(),
  lastCheckedAt: z.string().datetime().nullable(),
  lastSeenChapterExternalId: z.string().nullable(),
  checkFailureCount: z.number().int(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
