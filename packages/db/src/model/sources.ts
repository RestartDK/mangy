import { Schema } from "effect";

import { fieldColumns } from "./columns";
import { ChapterIdSchema, SeriesIdSchema, SourceIdSchema } from "./ids";

export const sourceRow = Schema.Struct({
  createdAt: Schema.Date,
  description: Schema.String,
  iconUrl: Schema.NullOr(Schema.String),
  id: SourceIdSchema,
  isEnabled: Schema.Boolean,
  languageCode: Schema.String,
  name: Schema.String,
  supportedLanguages: Schema.Array(Schema.String),
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
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    iconUrl: "icon_url",
    isEnabled: "is_enabled",
    languageCode: "language_code",
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
  })
);
export const sourceColumns = fieldColumns(sourceRow);

export const seriesRow = Schema.Struct({
  artistNames: Schema.Array(Schema.String),
  authorNames: Schema.Array(Schema.String),
  availableTranslatedLanguages: Schema.Array(Schema.String),
  canonicalUrl: Schema.NullOr(Schema.String),
  contentRating: Schema.NullOr(Schema.String),
  coverImageUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  description: Schema.NullOr(Schema.String),
  externalId: Schema.String,
  id: SeriesIdSchema,
  lastFetchedAt: Schema.Date,
  latestChapter: Schema.NullOr(Schema.String),
  originalLanguage: Schema.NullOr(Schema.String),
  publicationDemographic: Schema.NullOr(Schema.String),
  sourceId: SourceIdSchema,
  status: Schema.String,
  tags: Schema.Array(Schema.String),
  title: Schema.String,
  updatedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    artistNames: "artist_names",
    authorNames: "author_names",
    availableTranslatedLanguages: "available_translated_languages",
    canonicalUrl: "canonical_url",
    contentRating: "content_rating",
    coverImageUrl: "cover_image_url",
    createdAt: "created_at",
    externalId: "external_id",
    lastFetchedAt: "last_fetched_at",
    latestChapter: "latest_chapter",
    originalLanguage: "original_language",
    publicationDemographic: "publication_demographic",
    sourceId: "source_id",
    updatedAt: "updated_at",
  })
);
export const seriesColumns = fieldColumns(seriesRow);

export const chapterRow = Schema.Struct({
  chapterNumber: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  externalId: Schema.String,
  externalUrl: Schema.NullOr(Schema.String),
  id: ChapterIdSchema,
  isDownloaded: Schema.Boolean,
  isUnavailable: Schema.Boolean,
  pageCount: Schema.NullOr(Schema.Int),
  publishedAt: Schema.NullOr(Schema.Date),
  seriesId: SeriesIdSchema,
  sourceOrder: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  translatedLanguage: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
  volumeNumber: Schema.NullOr(Schema.String),
}).pipe(
  Schema.encodeKeys({
    chapterNumber: "chapter_number",
    createdAt: "created_at",
    externalId: "external_id",
    externalUrl: "external_url",
    isDownloaded: "is_downloaded",
    isUnavailable: "is_unavailable",
    pageCount: "page_count",
    publishedAt: "published_at",
    seriesId: "series_id",
    sourceOrder: "source_order",
    translatedLanguage: "translated_language",
    updatedAt: "updated_at",
    volumeNumber: "volume_number",
  })
);
export const chapterColumns = fieldColumns(chapterRow);
