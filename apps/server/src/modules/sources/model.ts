import { z } from "zod";

export const sourceCapabilitiesSchema = z.object({
  supportsPopular: z.boolean(),
  supportsLatest: z.boolean(),
  supportsTrending: z.boolean(),
  supportsSearch: z.boolean(),
  supportsFilters: z.boolean(),
  supportsSeriesDetails: z.boolean(),
  supportsChapterFeed: z.boolean(),
  supportsPageFetch: z.boolean(),
});

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  websiteUrl: z.string().url(),
  iconUrl: z.string().url().nullable(),
  languageCode: z.string(),
  supportedLanguages: z.array(z.string()),
  isEnabled: z.boolean(),
  capabilities: sourceCapabilitiesSchema,
});

export const sourceFilterOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const sourceFilterSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("select"),
    key: z.string(),
    label: z.string(),
    defaultValue: z.string().optional(),
    options: z.array(sourceFilterOptionSchema),
  }),
  z.object({
    type: z.literal("multiSelect"),
    key: z.string(),
    label: z.string(),
    defaultValue: z.array(z.string()).optional(),
    options: z.array(sourceFilterOptionSchema),
  }),
  z.object({
    type: z.literal("toggle"),
    key: z.string(),
    label: z.string(),
    defaultValue: z.boolean().optional(),
  }),
]);

export const sourceSeriesSchema = z.object({
  sourceId: z.string(),
  seriesId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  canonicalUrl: z.string().url().nullable(),
  coverImageUrl: z.string().url().nullable(),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]),
  originalLanguage: z.string().nullable(),
  latestChapter: z.string().nullable(),
  contentRating: z.string().nullable(),
  publicationDemographic: z.string().nullable(),
  authorNames: z.array(z.string()),
  artistNames: z.array(z.string()),
  tags: z.array(z.string()),
  availableTranslatedLanguages: z.array(z.string()),
});

export const sourceSeriesListSchema = z.object({
  items: z.array(sourceSeriesSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int().nullable(),
  hasNextPage: z.boolean(),
});

export const sourceDiscoverSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["popular", "latest", "trending"]),
  items: z.array(sourceSeriesSchema),
});

export const sourceSearchBody = z.object({
  query: z.string().trim().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(24).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const sourceDiscoverQuery = z.object({
  limit: z.coerce.number().int().min(1).max(24).optional(),
});

export const sourceParamsSchema = z.object({
  sourceId: z.string(),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
