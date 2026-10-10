import { Schema } from "effect";

import { fieldColumns } from "./columns";
import {
  ChapterIdSchema,
  DownloadArtifactIdSchema,
  DownloadDestinationIdSchema,
  DownloadJobIdSchema,
  SeriesIdSchema,
  UserIdSchema,
} from "./ids";

export const downloadJobTable = "download_job";
export const downloadJobRow = Schema.Struct({
  attempts: Schema.Int,
  chapterId: Schema.NullOr(ChapterIdSchema),
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  downloadDestinationId: Schema.NullOr(DownloadDestinationIdSchema),
  errorMessage: Schema.NullOr(Schema.String),
  id: DownloadJobIdSchema,
  leaseOwner: Schema.NullOr(Schema.String),
  leasedAt: Schema.NullOr(Schema.Date),
  maxAttempts: Schema.Int,
  progressPercent: Schema.Int,
  seriesId: Schema.NullOr(SeriesIdSchema),
  startedAt: Schema.NullOr(Schema.Date),
  status: Schema.Literals([
    "queued",
    "running",
    "retryableFailed",
    "completed",
    "cancelled",
  ]),
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}).pipe(
  Schema.encodeKeys({
    chapterId: "chapter_id",
    completedAt: "completed_at",
    createdAt: "created_at",
    downloadDestinationId: "download_destination_id",
    errorMessage: "error_message",
    leaseOwner: "lease_owner",
    leasedAt: "leased_at",
    maxAttempts: "max_attempts",
    progressPercent: "progress_percent",
    seriesId: "series_id",
    startedAt: "started_at",
    updatedAt: "updated_at",
    userId: "user_id",
  })
);
export const downloadJobColumns = fieldColumns(downloadJobRow);

export const downloadArtifactTable = "download_artifact";
export const downloadArtifactRow = Schema.Struct({
  chapterId: Schema.NullOr(ChapterIdSchema),
  createdAt: Schema.Date,
  downloadJobId: DownloadJobIdSchema,
  fileSizeBytes: Schema.NullOr(Schema.Int),
  id: DownloadArtifactIdSchema,
  importedToKomgaAt: Schema.NullOr(Schema.Date),
  outputPath: Schema.String,
  packageFormat: Schema.String,
  updatedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    chapterId: "chapter_id",
    createdAt: "created_at",
    downloadJobId: "download_job_id",
    fileSizeBytes: "file_size_bytes",
    importedToKomgaAt: "imported_to_komga_at",
    outputPath: "output_path",
    packageFormat: "package_format",
    updatedAt: "updated_at",
  })
);
export const downloadArtifactColumns = fieldColumns(downloadArtifactRow);
