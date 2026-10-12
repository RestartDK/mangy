import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import {
  SourceChapterIdSchema,
  SourceIdSchema,
  SourceSeriesIdSchema,
  TrackedSeriesStateIdSchema,
} from "./ids";
import { ErrorWithoutTag } from "./schema";
import { isoDateTimeString } from "./timestamps";

export const trackedSeriesSchema = Schema.Struct({
  checkFailureCount: Schema.Int,
  id: TrackedSeriesStateIdSchema,
  lastCheckedAt: Schema.OptionFromNullOr(isoDateTimeString),
  lastSeenChapterExternalId: Schema.OptionFromNullOr(SourceChapterIdSchema),
  nextCheckAt: Schema.OptionFromNullOr(isoDateTimeString),
  seriesId: SourceSeriesIdSchema,
  sourceId: SourceIdSchema,
  title: Schema.String,
});
export type TrackedSeries = typeof trackedSeriesSchema.Type;

export const refreshTrackedSeriesSchema = Schema.Struct({
  seriesId: SourceSeriesIdSchema,
  sourceId: SourceIdSchema,
});
export type RefreshTrackedSeries = typeof refreshTrackedSeriesSchema.Type;

export class RefreshFailed extends ErrorWithoutTag<RefreshFailed>(
  "RefreshFailed"
)(
  {
    _tag: Schema.tagDefaultOmit("RefreshFailed"),
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

export const TrackingApi = HttpApiGroup.make("tracking")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(trackedSeriesSchema),
    }),
    HttpApiEndpoint.post("refresh", "/refresh", {
      error: [Unauthorized, RefreshFailed],
      payload: refreshTrackedSeriesSchema,
      success: trackedSeriesSchema,
    })
  )
  .prefix("/api/tracking");
