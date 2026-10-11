import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  ChapterIdSchema,
  DownloadDestinationIdSchema,
  LibraryEntryIdSchema,
  SeriesIdSchema,
  UserIdSchema,
} from "./ids";

export const libraryEntryTable = "library_entry";

export class LibraryEntry extends Model.Class<LibraryEntry>("LibraryEntry")({
  autoDownload: Schema.Boolean,
  createdAt: Schema.Date,
  downloadDestinationId: Schema.OptionFromNullOr(DownloadDestinationIdSchema),
  id: LibraryEntryIdSchema,
  isTracked: Schema.Boolean,
  lastOpenedChapterId: Schema.OptionFromNullOr(ChapterIdSchema),
  seriesId: SeriesIdSchema,
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}) {}

export const libraryEntryColumns = {
  autoDownload: "auto_download",
  createdAt: "created_at",
  downloadDestinationId: "download_destination_id",
  id: "id",
  isTracked: "is_tracked",
  lastOpenedChapterId: "last_opened_chapter_id",
  seriesId: "series_id",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof LibraryEntry.fields, string>;
