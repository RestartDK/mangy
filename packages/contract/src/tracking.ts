import { SeriesIdSchema, SourceIdSchema } from "@mangy/db/model/ids";
import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { ErrorWithoutTag } from "./schema";
import { isoDateTimeString } from "./timestamps";

export const trackedSeriesSchema = Schema.Struct({
  checkFailureCount: Schema.Int,
  id: Schema.String,
  lastCheckedAt: Schema.OptionFromNullOr(isoDateTimeString),
  lastSeenChapterExternalId: Schema.OptionFromNullOr(Schema.String),
  nextCheckAt: Schema.OptionFromNullOr(isoDateTimeString),
  seriesId: SeriesIdSchema,
  sourceId: SourceIdSchema,
  title: Schema.String,
});
export type TrackedSeries = typeof trackedSeriesSchema.Type;

export const refreshTrackedSeriesSchema = Schema.Struct({
  seriesId: SeriesIdSchema,
  sourceId: SourceIdSchema,
});
export type RefreshTrackedSeries = typeof refreshTrackedSeriesSchema.Type;

export const decodeRefreshTrackedSeries = (
  input: unknown
): RefreshTrackedSeries =>
  Schema.decodeUnknownSync(refreshTrackedSeriesSchema)(input);

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
