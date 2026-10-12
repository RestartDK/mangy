import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  LibraryEntryIdSchema,
  SourceChapterIdSchema,
  TrackedSeriesStateIdSchema,
} from "./ids";

export const trackedSeriesStateTable = "tracked_series_state";

export class TrackedSeriesState extends Model.Class<TrackedSeriesState>(
  "TrackedSeriesState"
)({
  checkFailureCount: Schema.Int,
  createdAt: Schema.Date,
  id: TrackedSeriesStateIdSchema,
  lastCheckedAt: Schema.OptionFromNullOr(Schema.Date),
  lastSeenChapterExternalId: Schema.OptionFromNullOr(SourceChapterIdSchema),
  libraryEntryId: LibraryEntryIdSchema,
  nextCheckAt: Schema.OptionFromNullOr(Schema.Date),
  updatedAt: Schema.Date,
}) {}

export const trackedSeriesStateColumns = {
  checkFailureCount: "check_failure_count",
  createdAt: "created_at",
  id: "id",
  lastCheckedAt: "last_checked_at",
  lastSeenChapterExternalId: "last_seen_chapter_external_id",
  libraryEntryId: "library_entry_id",
  nextCheckAt: "next_check_at",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof TrackedSeriesState.fields, string>;
