import { Schema } from "effect";

import { defineTable } from "./table";

export const {
  row: sourceRow,
  columns: sourceColumns,
  table: sourceTable,
} = defineTable("source", {
  createdAt: { column: "created_at", schema: Schema.Date },
  description: { column: "description", schema: Schema.String },
  iconUrl: { column: "icon_url", nullable: true, schema: Schema.String },
  id: { column: "id", schema: Schema.String },
  isEnabled: { column: "is_enabled", schema: Schema.Boolean },
  languageCode: { column: "language_code", schema: Schema.String },
  name: { column: "name", schema: Schema.String },
  supportedLanguages: {
    column: "supported_languages",
    schema: Schema.mutable(Schema.Array(Schema.String)),
  },
  supportsChapterFeed: {
    column: "supports_chapter_feed",
    schema: Schema.Boolean,
  },
  supportsFilters: { column: "supports_filters", schema: Schema.Boolean },
  supportsLatest: { column: "supports_latest", schema: Schema.Boolean },
  supportsPageFetch: { column: "supports_page_fetch", schema: Schema.Boolean },
  supportsPopular: { column: "supports_popular", schema: Schema.Boolean },
  supportsSearch: { column: "supports_search", schema: Schema.Boolean },
  supportsSeriesDetails: {
    column: "supports_series_details",
    schema: Schema.Boolean,
  },
  supportsTrending: { column: "supports_trending", schema: Schema.Boolean },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  websiteUrl: { column: "website_url", schema: Schema.String },
});

export const {
  row: seriesRow,
  columns: seriesColumns,
  table: seriesTable,
} = defineTable("series", {
  artistNames: {
    column: "artist_names",
    schema: Schema.mutable(Schema.Array(Schema.String)),
  },
  authorNames: {
    column: "author_names",
    schema: Schema.mutable(Schema.Array(Schema.String)),
  },
  availableTranslatedLanguages: {
    column: "available_translated_languages",
    schema: Schema.mutable(Schema.Array(Schema.String)),
  },
  canonicalUrl: {
    column: "canonical_url",
    nullable: true,
    schema: Schema.String,
  },
  contentRating: {
    column: "content_rating",
    nullable: true,
    schema: Schema.String,
  },
  coverImageUrl: {
    column: "cover_image_url",
    nullable: true,
    schema: Schema.String,
  },
  createdAt: { column: "created_at", schema: Schema.Date },
  description: { column: "description", nullable: true, schema: Schema.String },
  externalId: { column: "external_id", schema: Schema.String },
  id: { column: "id", schema: Schema.String },
  lastFetchedAt: { column: "last_fetched_at", schema: Schema.Date },
  latestChapter: {
    column: "latest_chapter",
    nullable: true,
    schema: Schema.String,
  },
  originalLanguage: {
    column: "original_language",
    nullable: true,
    schema: Schema.String,
  },
  publicationDemographic: {
    column: "publication_demographic",
    nullable: true,
    schema: Schema.String,
  },
  sourceId: { column: "source_id", schema: Schema.String },
  status: { column: "status", schema: Schema.String },
  tags: { column: "tags", schema: Schema.mutable(Schema.Array(Schema.String)) },
  title: { column: "title", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
});

export const {
  row: chapterRow,
  columns: chapterColumns,
  table: chapterTable,
} = defineTable("chapter", {
  chapterNumber: {
    column: "chapter_number",
    nullable: true,
    schema: Schema.String,
  },
  createdAt: { column: "created_at", schema: Schema.Date },
  externalId: { column: "external_id", schema: Schema.String },
  externalUrl: {
    column: "external_url",
    nullable: true,
    schema: Schema.String,
  },
  id: { column: "id", schema: Schema.String },
  isDownloaded: { column: "is_downloaded", schema: Schema.Boolean },
  isUnavailable: { column: "is_unavailable", schema: Schema.Boolean },
  pageCount: { column: "page_count", nullable: true, schema: Schema.Int },
  publishedAt: { column: "published_at", nullable: true, schema: Schema.Date },
  seriesId: { column: "series_id", schema: Schema.String },
  sourceOrder: {
    column: "source_order",
    nullable: true,
    schema: Schema.String,
  },
  title: { column: "title", nullable: true, schema: Schema.String },
  translatedLanguage: {
    column: "translated_language",
    nullable: true,
    schema: Schema.String,
  },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  volumeNumber: {
    column: "volume_number",
    nullable: true,
    schema: Schema.String,
  },
});
