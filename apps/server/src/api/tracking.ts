import { SeriesIdSchema, SourceIdSchema } from "@mangy/db/model/ids";
import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { ErrorWithoutTag } from "./schema";

const isoDateTimeString = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
);

export const trackedSeriesSchema = Schema.Struct({
  checkFailureCount: Schema.Int,
  id: Schema.String,
  lastCheckedAt: Schema.NullOr(isoDateTimeString),
  lastSeenChapterExternalId: Schema.NullOr(Schema.String),
  nextCheckAt: Schema.NullOr(isoDateTimeString),
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
