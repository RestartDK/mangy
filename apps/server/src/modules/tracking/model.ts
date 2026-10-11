import { z } from "zod";

export const trackedSeriesSchema = z.object({
  checkFailureCount: z.number().int(),
  id: z.string(),
  lastCheckedAt: z.iso.datetime().nullable(),
  lastSeenChapterExternalId: z.string().nullable(),
  nextCheckAt: z.iso.datetime().nullable(),
  seriesId: z.string(),
  sourceId: z.string(),
  title: z.string(),
});

export const refreshTrackedSeriesBody = z.object({
  seriesId: z.string(),
  sourceId: z.string(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
