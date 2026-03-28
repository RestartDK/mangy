import { z } from "zod";

export const downloadJobSchema = z.object({
  id: z.string(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
