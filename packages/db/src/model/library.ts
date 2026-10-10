import { Schema } from "effect";

import { defineTable } from "./table";

export const {
  row: downloadDestinationRow,
  columns: downloadDestinationColumns,
  table: downloadDestinationTable,
} = defineTable("download_destination", {
  absolutePath: { column: "absolute_path", schema: Schema.String },
  createdAt: { column: "created_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  isDefault: { column: "is_default", schema: Schema.Boolean },
  isEnabled: { column: "is_enabled", schema: Schema.Boolean },
  komgaLibraryId: {
    column: "komga_library_id",
    nullable: true,
    schema: Schema.String,
  },
  name: { column: "name", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: libraryEntryRow,
  columns: libraryEntryColumns,
  table: libraryEntryTable,
} = defineTable("library_entry", {
  autoDownload: { column: "auto_download", schema: Schema.Boolean },
  createdAt: { column: "created_at", schema: Schema.Date },
  downloadDestinationId: {
    column: "download_destination_id",
    nullable: true,
    schema: Schema.String,
  },
  id: { column: "id", schema: Schema.String },
  isTracked: { column: "is_tracked", schema: Schema.Boolean },
  lastOpenedChapterId: {
    column: "last_opened_chapter_id",
    nullable: true,
    schema: Schema.String,
  },
  seriesId: { column: "series_id", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: trackedSeriesStateRow,
  columns: trackedSeriesStateColumns,
  table: trackedSeriesStateTable,
} = defineTable("tracked_series_state", {
  checkFailureCount: { column: "check_failure_count", schema: Schema.Int },
  createdAt: { column: "created_at", schema: Schema.Date },
  id: { column: "id", schema: Schema.String },
  lastCheckedAt: {
    column: "last_checked_at",
    nullable: true,
    schema: Schema.Date,
  },
  lastSeenChapterExternalId: {
    column: "last_seen_chapter_external_id",
    nullable: true,
    schema: Schema.String,
  },
  libraryEntryId: { column: "library_entry_id", schema: Schema.String },
  nextCheckAt: { column: "next_check_at", nullable: true, schema: Schema.Date },
  updatedAt: { column: "updated_at", schema: Schema.Date },
});
