import { Schema } from "effect";
import { Model } from "effect/schema";

import { ChapterIdSchema, SeriesIdSchema, SourceChapterIdSchema } from "./ids";

export const chapterTable = "chapter";

export class Chapter extends Model.Class<Chapter>("Chapter")({
  chapterNumber: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.Date,
  externalId: SourceChapterIdSchema,
  externalUrl: Schema.OptionFromNullOr(Schema.String),
  id: ChapterIdSchema,
  isDownloaded: Schema.Boolean,
  isUnavailable: Schema.Boolean,
  pageCount: Schema.OptionFromNullOr(Schema.Int),
  publishedAt: Schema.OptionFromNullOr(Schema.Date),
  seriesId: SeriesIdSchema,
  sourceOrder: Schema.OptionFromNullOr(Schema.String),
  title: Schema.OptionFromNullOr(Schema.String),
  translatedLanguage: Schema.OptionFromNullOr(Schema.String),
  updatedAt: Schema.Date,
  volumeNumber: Schema.OptionFromNullOr(Schema.String),
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
