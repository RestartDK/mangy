import { Schema } from "effect";
import { Model } from "effect/schema";

import { SeriesIdSchema, SourceIdSchema } from "./ids";

export const seriesTable = "series";

export class Series extends Model.Class<Series>("Series")({
  artistNames: Schema.mutable(Schema.Array(Schema.String)),
  authorNames: Schema.mutable(Schema.Array(Schema.String)),
  availableTranslatedLanguages: Schema.mutable(Schema.Array(Schema.String)),
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
  tags: Schema.mutable(Schema.Array(Schema.String)),
  title: Schema.String,
  updatedAt: Schema.Date,
}) {}

export const seriesColumns = {
  artistNames: "artist_names",
  authorNames: "author_names",
  availableTranslatedLanguages: "available_translated_languages",
  canonicalUrl: "canonical_url",
  contentRating: "content_rating",
  coverImageUrl: "cover_image_url",
  createdAt: "created_at",
  description: "description",
  externalId: "external_id",
  id: "id",
  lastFetchedAt: "last_fetched_at",
  latestChapter: "latest_chapter",
  originalLanguage: "original_language",
  publicationDemographic: "publication_demographic",
  sourceId: "source_id",
  status: "status",
  tags: "tags",
  title: "title",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof Series.fields, string>;
