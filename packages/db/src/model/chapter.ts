import { Schema } from "effect";
import { Model } from "effect/schema";

import { ChapterIdSchema, SeriesIdSchema } from "./ids";

export const chapterTable = "chapter";

export class Chapter extends Model.Class<Chapter>("Chapter")({
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
}) {}

export const chapterColumns = {
  chapterNumber: "chapter_number",
  createdAt: "created_at",
  externalId: "external_id",
  externalUrl: "external_url",
  id: "id",
  isDownloaded: "is_downloaded",
  isUnavailable: "is_unavailable",
  pageCount: "page_count",
  publishedAt: "published_at",
  seriesId: "series_id",
  sourceOrder: "source_order",
  title: "title",
  translatedLanguage: "translated_language",
  updatedAt: "updated_at",
  volumeNumber: "volume_number",
} as const satisfies Record<keyof typeof Chapter.fields, string>;
