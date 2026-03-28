import { z } from "zod";

export const downloadJobSchema = z.object({
  id: z.string(),
  sourceId: z.string().nullable(),
  seriesId: z.string().nullable(),
  chapterId: z.string().nullable(),
  status: z.enum([
    "queued",
    "running",
    "retryableFailed",
    "completed",
    "cancelled",
  ]),
  progressPercent: z.number().int(),
  attempts: z.number().int(),
  maxAttempts: z.number().int(),
  errorMessage: z.string().nullable(),
  seriesTitle: z.string().nullable(),
  chapterTitle: z.string().nullable(),
  destinationName: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const enqueueDownloadBody = z.object({
  sourceId: z.string(),
  seriesId: z.string(),
  chapterId: z.string(),
  downloadDestinationId: z.string().optional(),
});

export const downloadJobParamsSchema = z.object({
  jobId: z.string(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
