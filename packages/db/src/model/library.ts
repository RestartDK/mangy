import { Schema } from "effect";

import { fieldColumns } from "./columns";
import {
  ChapterIdSchema,
  DownloadDestinationIdSchema,
  LibraryEntryIdSchema,
  SeriesIdSchema,
  TrackedSeriesStateIdSchema,
  UserIdSchema,
} from "./ids";

export const downloadDestinationTable = "download_destination";
export const downloadDestinationRow = Schema.Struct({
  absolutePath: Schema.String,
  createdAt: Schema.Date,
  id: DownloadDestinationIdSchema,
  isDefault: Schema.Boolean,
  isEnabled: Schema.Boolean,
  komgaLibraryId: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    absolutePath: "absolute_path",
    createdAt: "created_at",
    isDefault: "is_default",
    isEnabled: "is_enabled",
    komgaLibraryId: "komga_library_id",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const downloadDestinationColumns = fieldColumns(downloadDestinationRow);

export const libraryEntryTable = "library_entry";
export const libraryEntryRow = Schema.Struct({
  autoDownload: Schema.Boolean,
  createdAt: Schema.Date,
  downloadDestinationId: Schema.NullOr(DownloadDestinationIdSchema),
  id: LibraryEntryIdSchema,
  isTracked: Schema.Boolean,
  lastOpenedChapterId: Schema.NullOr(ChapterIdSchema),
  seriesId: SeriesIdSchema,
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    autoDownload: "auto_download",
    createdAt: "created_at",
    downloadDestinationId: "download_destination_id",
    isTracked: "is_tracked",
    lastOpenedChapterId: "last_opened_chapter_id",
    seriesId: "series_id",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const libraryEntryColumns = fieldColumns(libraryEntryRow);

export const trackedSeriesStateTable = "tracked_series_state";
export const trackedSeriesStateRow = Schema.Struct({
  checkFailureCount: Schema.Int,
  createdAt: Schema.Date,
  id: TrackedSeriesStateIdSchema,
  lastCheckedAt: Schema.NullOr(Schema.Date),
  lastSeenChapterExternalId: Schema.NullOr(Schema.String),
  libraryEntryId: LibraryEntryIdSchema,
  nextCheckAt: Schema.NullOr(Schema.Date),
  updatedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    checkFailureCount: "check_failure_count",
    createdAt: "created_at",
    lastCheckedAt: "last_checked_at",
    lastSeenChapterExternalId: "last_seen_chapter_external_id",
    libraryEntryId: "library_entry_id",
    nextCheckAt: "next_check_at",
    updatedAt: "updated_at",
  })
);
export const trackedSeriesStateColumns = fieldColumns(trackedSeriesStateRow);
