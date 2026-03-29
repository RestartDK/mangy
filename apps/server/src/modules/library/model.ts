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

export const librarySeriesQuerySchema = z.object({
  sourceId: z.string(),
  seriesId: z.string(),
});

export const removeLibrarySeriesResponseSchema = z.object({
  sourceId: z.string(),
  seriesId: z.string(),
});

export const trackedSeriesStateSummarySchema = z.object({
  id: z.string(),
  nextCheckAt: z.string().datetime().nullable(),
  lastCheckedAt: z.string().datetime().nullable(),
  lastSeenChapterExternalId: z.string().nullable(),
  checkFailureCount: z.number().int(),
});

export const librarySeriesStateSchema = z.object({
  libraryEntryId: z.string().nullable(),
  sourceId: z.string(),
  seriesId: z.string(),
  isTracked: z.boolean(),
  autoDownload: z.boolean(),
  downloadDestinationId: z.string().nullable(),
  downloadDestinationName: z.string().nullable(),
  trackingState: trackedSeriesStateSummarySchema.nullable(),
});

export const updateLibrarySeriesStateBody = z.object({
  sourceId: z.string(),
  seriesId: z.string(),
  isTracked: z.boolean(),
  autoDownload: z.boolean(),
  downloadDestinationId: z.string().nullable().optional(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
