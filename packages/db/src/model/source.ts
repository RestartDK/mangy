import { Schema } from "effect";
import { Model } from "effect/schema";

import { SourceIdSchema } from "./ids";

export const sourceTable = "source";

export class Source extends Model.Class<Source>("Source")({
  createdAt: Schema.Date,
  description: Schema.String,
  iconUrl: Schema.OptionFromNullOr(Schema.String),
  id: SourceIdSchema,
  isEnabled: Schema.Boolean,
  languageCode: Schema.String,
  name: Schema.String,
  supportedLanguages: Schema.mutable(Schema.Array(Schema.String)),
  supportsChapterFeed: Schema.Boolean,
  supportsFilters: Schema.Boolean,
  supportsLatest: Schema.Boolean,
  supportsPageFetch: Schema.Boolean,
  supportsPopular: Schema.Boolean,
  supportsSearch: Schema.Boolean,
  supportsSeriesDetails: Schema.Boolean,
  supportsTrending: Schema.Boolean,
  updatedAt: Schema.Date,
  websiteUrl: Schema.String,
}) {}

export const sourceColumns = {
  createdAt: "created_at",
  description: "description",
  iconUrl: "icon_url",
  id: "id",
  isEnabled: "is_enabled",
  languageCode: "language_code",
  name: "name",
  supportedLanguages: "supported_languages",
  supportsChapterFeed: "supports_chapter_feed",
  supportsFilters: "supports_filters",
  supportsLatest: "supports_latest",
  supportsPageFetch: "supports_page_fetch",
  supportsPopular: "supports_popular",
  supportsSearch: "supports_search",
  supportsSeriesDetails: "supports_series_details",
  supportsTrending: "supports_trending",
  updatedAt: "updated_at",
  websiteUrl: "website_url",
} as const satisfies Record<keyof typeof Source.fields, string>;

export const sourceRow = Source.pipe(Schema.encodeKeys(sourceColumns));
