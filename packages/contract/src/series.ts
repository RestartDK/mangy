import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import {
  SourceChapterIdSchema,
  SourceIdSchema,
  SourceSeriesIdSchema,
} from "./ids";
import { SeriesPageNotFound } from "./series-page-not-found";
import { SeriesRequestFailed } from "./series-request-failed";
import { sourceSeriesSchema } from "./sources";
import { isoDateTimeString } from "./timestamps";

export const seriesParamsSchema = Schema.Struct({
  seriesId: SourceSeriesIdSchema,
});

export const seriesSourceQuerySchema = Schema.Struct({
  sourceId: SourceIdSchema,
});

export const seriesChapterParamsSchema = Schema.Struct({
  chapterId: SourceChapterIdSchema,
  seriesId: SourceSeriesIdSchema,
});

export const seriesPageParamsSchema = Schema.Struct({
  chapterId: SourceChapterIdSchema,
  pageIndex: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0)
  ),
  seriesId: SourceSeriesIdSchema,
});

export const chapterSchema = Schema.Struct({
  chapterId: SourceChapterIdSchema,
  chapterNumber: Schema.NullOr(Schema.String),
  externalUrl: Schema.NullOr(Schema.String),
  isUnavailable: Schema.Boolean,
  pageCount: Schema.NullOr(Schema.Int),
  publishedAt: Schema.NullOr(isoDateTimeString),
  sourceOrder: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  translatedLanguage: Schema.NullOr(Schema.String),
  volumeNumber: Schema.NullOr(Schema.String),
});
export type SeriesChapter = typeof chapterSchema.Type;

export const sourcePageSchema = Schema.Struct({
  imageUrl: Schema.String,
  index: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

export const sourcePageListSchema = Schema.Struct({
  pages: Schema.Array(sourcePageSchema),
});
export type SourcePageList = typeof sourcePageListSchema.Type;

export const SeriesApi = HttpApiGroup.make("series")
  .add(
    HttpApiEndpoint.get("get", "/:seriesId", {
      error: [Unauthorized, SeriesRequestFailed],
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      success: sourceSeriesSchema,
    }),
    HttpApiEndpoint.get("getChapters", "/:seriesId/chapters", {
      error: [Unauthorized, SeriesRequestFailed],
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      success: Schema.Array(chapterSchema),
    }),
    HttpApiEndpoint.get("getPages", "/:seriesId/chapters/:chapterId/pages", {
      error: [Unauthorized, SeriesRequestFailed, SeriesPageNotFound],
      params: seriesChapterParamsSchema,
      query: seriesSourceQuerySchema,
      success: sourcePageListSchema,
    })
  )
  .prefix("/api/series");
