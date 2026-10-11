import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import { isoDateTimeString } from "./timestamps";

export const libraryItemSchema = Schema.Struct({
  autoDownload: Schema.Boolean,
  coverImageUrl: Schema.OptionFromNullOr(Schema.String),
  destinationName: Schema.OptionFromNullOr(Schema.String),
  id: Schema.String,
  isTracked: Schema.Boolean,
  seriesId: Schema.String,
  sourceId: Schema.String,
  title: Schema.String,
  updatedAt: isoDateTimeString,
});
export type LibraryItem = typeof libraryItemSchema.Type;

export const librarySeriesQuerySchema = Schema.Struct({
  seriesId: Schema.String,
  sourceId: Schema.String,
});

export const trackedSeriesStateSummarySchema = Schema.Struct({
  checkFailureCount: Schema.Int,
  id: Schema.String,
  lastCheckedAt: Schema.OptionFromNullOr(isoDateTimeString),
  lastSeenChapterExternalId: Schema.OptionFromNullOr(Schema.String),
  nextCheckAt: Schema.OptionFromNullOr(isoDateTimeString),
});

export const librarySeriesStateSchema = Schema.Struct({
  autoDownload: Schema.Boolean,
  downloadDestinationId: Schema.OptionFromNullOr(Schema.String),
  downloadDestinationName: Schema.OptionFromNullOr(Schema.String),
  isTracked: Schema.Boolean,
  libraryEntryId: Schema.OptionFromNullOr(Schema.String),
  seriesId: Schema.String,
  sourceId: Schema.String,
  trackingState: Schema.OptionFromNullOr(trackedSeriesStateSummarySchema),
});
export type LibrarySeriesState = typeof librarySeriesStateSchema.Type;

export const updateLibrarySeriesStateBody = Schema.Struct({
  autoDownload: Schema.Boolean,
  downloadDestinationId: Schema.optional(Schema.NullOr(Schema.String)),
  isTracked: Schema.Boolean,
  seriesId: Schema.String,
  sourceId: Schema.String,
});
export type UpdateLibrarySeriesState = typeof updateLibrarySeriesStateBody.Type;

export const removeLibrarySeriesResponseSchema = Schema.Struct({
  seriesId: Schema.String,
  sourceId: Schema.String,
});

export const LibraryApi = HttpApiGroup.make("library")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(libraryItemSchema),
    }),
    HttpApiEndpoint.get("getSeriesState", "/series-state", {
      error: [Unauthorized],
      query: librarySeriesQuerySchema,
      success: librarySeriesStateSchema,
    }),
    HttpApiEndpoint.patch("updateSeriesState", "/series-state", {
      error: [Unauthorized, BadRequest],
      payload: updateLibrarySeriesStateBody,
      success: librarySeriesStateSchema,
    }),
    HttpApiEndpoint.delete("removeSeries", "/series-state", {
      error: [Unauthorized, BadRequest],
      query: librarySeriesQuerySchema,
      success: removeLibrarySeriesResponseSchema,
    })
  )
  .prefix("/api/library");
