import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import { isoDateTimeString } from "./timestamps";

export const downloadJobSchema = Schema.Struct({
  attempts: Schema.Int,
  chapterId: Schema.NullOr(Schema.String),
  chapterTitle: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(isoDateTimeString),
  createdAt: isoDateTimeString,
  destinationName: Schema.NullOr(Schema.String),
  errorMessage: Schema.NullOr(Schema.String),
  id: Schema.String,
  maxAttempts: Schema.Int,
  progressPercent: Schema.Int,
  seriesId: Schema.NullOr(Schema.String),
  seriesTitle: Schema.NullOr(Schema.String),
  sourceId: Schema.NullOr(Schema.String),
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
  chapterId: Schema.String,
  downloadDestinationId: Schema.optional(Schema.String),
  seriesId: Schema.String,
  sourceId: Schema.String,
});

export const downloadJobParamsSchema = Schema.Struct({
  jobId: Schema.String,
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
