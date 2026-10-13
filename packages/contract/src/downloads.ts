import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import {
  DownloadDestinationIdSchema,
  DownloadJobIdSchema,
  SourceChapterIdSchema,
  SourceIdSchema,
  SourceSeriesIdSchema,
} from "./ids";
import { isoDateTimeString } from "./timestamps";

export const downloadJobSchema = Schema.Struct({
  attempts: Schema.Int,
  chapterId: Schema.OptionFromNullOr(SourceChapterIdSchema),
  chapterTitle: Schema.OptionFromNullOr(Schema.String),
  completedAt: Schema.OptionFromNullOr(isoDateTimeString),
  createdAt: isoDateTimeString,
  destinationName: Schema.OptionFromNullOr(Schema.String),
  errorMessage: Schema.OptionFromNullOr(Schema.String),
  id: DownloadJobIdSchema,
  maxAttempts: Schema.Int,
  progressPercent: Schema.Int,
  seriesId: Schema.OptionFromNullOr(SourceSeriesIdSchema),
  seriesTitle: Schema.OptionFromNullOr(Schema.String),
  sourceId: Schema.OptionFromNullOr(SourceIdSchema),
  status: Schema.Literals([
    "queued",
    "running",
    "retryableFailed",
    "completed",
    "cancelled",
  ]),
  updatedAt: isoDateTimeString,
});
export type DownloadJob = typeof downloadJobSchema.Type;

export const enqueueDownloadBody = Schema.Struct({
  chapterId: SourceChapterIdSchema,
  downloadDestinationId: Schema.optional(DownloadDestinationIdSchema),
  seriesId: SourceSeriesIdSchema,
  sourceId: SourceIdSchema,
});

export const downloadJobParamsSchema = Schema.Struct({
  jobId: DownloadJobIdSchema,
});

export type DownloadJobParams = typeof downloadJobParamsSchema.Type;

export type EnqueueDownload = typeof enqueueDownloadBody.Type;

export const DownloadsApi = HttpApiGroup.make("downloads")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(downloadJobSchema),
    }),
    HttpApiEndpoint.post("enqueue", "/", {
      error: [Unauthorized, BadRequest],
      payload: enqueueDownloadBody,
      success: downloadJobSchema,
    }),
    HttpApiEndpoint.post("cancel", "/:jobId/cancel", {
      error: [Unauthorized, BadRequest],
      params: downloadJobParamsSchema,
      success: downloadJobSchema,
    }),
    HttpApiEndpoint.post("retry", "/:jobId/retry", {
      error: [Unauthorized, BadRequest],
      params: downloadJobParamsSchema,
      success: downloadJobSchema,
    })
  )
  .prefix("/api/downloads");
