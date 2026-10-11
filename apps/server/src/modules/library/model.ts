import { z } from "zod";

export const libraryItemSchema = z.object({
  autoDownload: z.boolean(),
  coverImageUrl: z.url().nullable(),
  destinationName: z.string().nullable(),
  id: z.string(),
  isTracked: z.boolean(),
  seriesId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  updatedAt: z.iso.datetime(),
});

export const librarySeriesQuerySchema = z.object({
  seriesId: z.string(),
  sourceId: z.string(),
});

export const removeLibrarySeriesResponseSchema = z.object({
  seriesId: z.string(),
  sourceId: z.string(),
});

export const trackedSeriesStateSummarySchema = z.object({
  checkFailureCount: z.number().int(),
  id: z.string(),
  lastCheckedAt: z.iso.datetime().nullable(),
  lastSeenChapterExternalId: z.string().nullable(),
  nextCheckAt: z.iso.datetime().nullable(),
});

export const librarySeriesStateSchema = z.object({
  autoDownload: z.boolean(),
  downloadDestinationId: z.string().nullable(),
  downloadDestinationName: z.string().nullable(),
  isTracked: z.boolean(),
  libraryEntryId: z.string().nullable(),
  seriesId: z.string(),
  sourceId: z.string(),
  trackingState: trackedSeriesStateSummarySchema.nullable(),
});

export const updateLibrarySeriesStateBody = z.object({
  autoDownload: z.boolean(),
  downloadDestinationId: z.string().nullable().optional(),
  isTracked: z.boolean(),
  seriesId: z.string(),
  sourceId: z.string(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});

export const badRequestResponseSchema = z.object({
  message: z.string(),
});
