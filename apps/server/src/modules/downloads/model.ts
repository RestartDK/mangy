import { z } from "zod";

export const downloadJobSchema = z.object({
  attempts: z.number().int(),
  chapterId: z.string().nullable(),
  chapterTitle: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  destinationName: z.string().nullable(),
  errorMessage: z.string().nullable(),
  id: z.string(),
  maxAttempts: z.number().int(),
  progressPercent: z.number().int(),
  seriesId: z.string().nullable(),
  seriesTitle: z.string().nullable(),
  sourceId: z.string().nullable(),
  status: z.enum([
    "queued",
    "running",
    "retryableFailed",
    "completed",
    "cancelled",
  ]),
  updatedAt: z.iso.datetime(),
});

export const enqueueDownloadBody = z.object({
  chapterId: z.string(),
  downloadDestinationId: z.string().optional(),
  seriesId: z.string(),
  sourceId: z.string(),
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
