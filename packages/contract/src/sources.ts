import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";

export const sourceCapabilitiesSchema = Schema.Struct({
  supportsChapterFeed: Schema.Boolean,
  supportsFilters: Schema.Boolean,
  supportsLatest: Schema.Boolean,
  supportsPageFetch: Schema.Boolean,
  supportsPopular: Schema.Boolean,
  supportsSearch: Schema.Boolean,
  supportsSeriesDetails: Schema.Boolean,
  supportsTrending: Schema.Boolean,
});

export const sourceSchema = Schema.Struct({
  capabilities: sourceCapabilitiesSchema,
  description: Schema.String,
  iconUrl: Schema.OptionFromNullOr(Schema.String),
  id: Schema.String,
  isEnabled: Schema.Boolean,
  languageCode: Schema.String,
  name: Schema.String,
  supportedLanguages: Schema.Array(Schema.String),
  websiteUrl: Schema.String,
});
export type SourceSummary = typeof sourceSchema.Type;

export const sourceFilterOptionSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
});

export const sourceFilterSchema = Schema.Union([
  Schema.Struct({
    defaultValue: Schema.optional(Schema.String),
    key: Schema.String,
    label: Schema.String,
    options: Schema.Array(sourceFilterOptionSchema),
    type: Schema.Literal("select"),
  }),
  Schema.Struct({
    defaultValue: Schema.optional(Schema.Array(Schema.String)),
    key: Schema.String,
    label: Schema.String,
    options: Schema.Array(sourceFilterOptionSchema),
    type: Schema.Literal("multiSelect"),
  }),
  Schema.Struct({
    defaultValue: Schema.optional(Schema.Boolean),
    key: Schema.String,
    label: Schema.String,
    type: Schema.Literal("toggle"),
  }),
]);
export type SourceFilterDefinition = typeof sourceFilterSchema.Type;

export const sourceSeriesSchema = Schema.Struct({
  artistNames: Schema.Array(Schema.String),
  authorNames: Schema.Array(Schema.String),
  availableTranslatedLanguages: Schema.Array(Schema.String),
  canonicalUrl: Schema.NullOr(Schema.String),
  contentRating: Schema.NullOr(Schema.String),
  coverImageUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  latestChapter: Schema.NullOr(Schema.String),
  originalLanguage: Schema.NullOr(Schema.String),
  publicationDemographic: Schema.NullOr(Schema.String),
  seriesId: Schema.String,
  sourceId: Schema.String,
  status: Schema.Literals([
    "ongoing",
    "completed",
    "hiatus",
    "cancelled",
    "unknown",
  ]),
  tags: Schema.Array(Schema.String),
  title: Schema.String,
});
export type SourceSeries = typeof sourceSeriesSchema.Type;

export const sourceSeriesListSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  items: Schema.Array(sourceSeriesSchema),
  page: Schema.Int,
  pageSize: Schema.Int,
  total: Schema.NullOr(Schema.Int),
});
export type SourceSeriesList = typeof sourceSeriesListSchema.Type;

export const sourceDiscoverSectionSchema = Schema.Struct({
  id: Schema.String,
  items: Schema.Array(sourceSeriesSchema),
  title: Schema.String,
  type: Schema.Literals(["popular", "latest", "trending"]),
});
export type DiscoverSection = typeof sourceDiscoverSectionSchema.Type;

export const sourceSearchBody = Schema.Struct({
  filters: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  page: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  pageSize: Schema.optional(
    Schema.Int.check(Schema.isBetween({ maximum: 24, minimum: 1 }))
  ),
  query: Schema.optional(Schema.Trim),
});
export type SourceSearchInput = typeof sourceSearchBody.Type;

export const sourceDiscoverQuery = Schema.Struct({
  limit: Schema.optional(
    Schema.Int.check(Schema.isBetween({ maximum: 24, minimum: 1 }))
  ),
});

export const sourceParamsSchema = Schema.Struct({
  sourceId: Schema.String,
});

export const SourcesApi = HttpApiGroup.make("sources")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(sourceSchema),
    }),
    HttpApiEndpoint.get("getFilters", "/:sourceId/filters", {
      error: [Unauthorized],
      params: sourceParamsSchema,
      success: Schema.Array(sourceFilterSchema),
    }),
    HttpApiEndpoint.get("discover", "/:sourceId/discover", {
      error: [Unauthorized],
      params: sourceParamsSchema,
      query: sourceDiscoverQuery,
      success: Schema.Array(sourceDiscoverSectionSchema),
    }),
    HttpApiEndpoint.post("search", "/:sourceId/search", {
      error: [Unauthorized],
      params: sourceParamsSchema,
      payload: sourceSearchBody,
      success: sourceSeriesListSchema,
    })
  )
  .prefix("/api/sources");
