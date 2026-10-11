import { z } from "zod";

export const sourceCapabilitiesSchema = z.object({
  supportsChapterFeed: z.boolean(),
  supportsFilters: z.boolean(),
  supportsLatest: z.boolean(),
  supportsPageFetch: z.boolean(),
  supportsPopular: z.boolean(),
  supportsSearch: z.boolean(),
  supportsSeriesDetails: z.boolean(),
  supportsTrending: z.boolean(),
});

export const sourceSchema = z.object({
  capabilities: sourceCapabilitiesSchema,
  description: z.string(),
  iconUrl: z.url().nullable(),
  id: z.string(),
  isEnabled: z.boolean(),
  languageCode: z.string(),
  name: z.string(),
  supportedLanguages: z.array(z.string()),
  websiteUrl: z.url(),
});

export const sourceFilterOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const sourceFilterSchema = z.discriminatedUnion("type", [
  z.object({
    defaultValue: z.string().optional(),
    key: z.string(),
    label: z.string(),
    options: z.array(sourceFilterOptionSchema),
    type: z.literal("select"),
  }),
  z.object({
    defaultValue: z.array(z.string()).optional(),
    key: z.string(),
    label: z.string(),
    options: z.array(sourceFilterOptionSchema),
    type: z.literal("multiSelect"),
  }),
  z.object({
    defaultValue: z.boolean().optional(),
    key: z.string(),
    label: z.string(),
    type: z.literal("toggle"),
  }),
]);

export const sourceSeriesSchema = z.object({
  artistNames: z.array(z.string()),
  authorNames: z.array(z.string()),
  availableTranslatedLanguages: z.array(z.string()),
  canonicalUrl: z.url().nullable(),
  contentRating: z.string().nullable(),
  coverImageUrl: z.url().nullable(),
  description: z.string().nullable(),
  latestChapter: z.string().nullable(),
  originalLanguage: z.string().nullable(),
  publicationDemographic: z.string().nullable(),
  seriesId: z.string(),
  sourceId: z.string(),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]),
  tags: z.array(z.string()),
  title: z.string(),
});

export const sourceSeriesListSchema = z.object({
  hasNextPage: z.boolean(),
  items: z.array(sourceSeriesSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int().nullable(),
});

export const sourceDiscoverSectionSchema = z.object({
  id: z.string(),
  items: z.array(sourceSeriesSchema),
  title: z.string(),
  type: z.enum(["popular", "latest", "trending"]),
});

export const sourceSearchBody = z.object({
  filters: z.record(z.string(), z.unknown()).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(24).optional(),
  query: z.string().trim().optional(),
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
