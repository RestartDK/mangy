import { Schema } from "effect";

import { defineTable } from "./table";

export const {
  row: downloadJobRow,
  columns: downloadJobColumns,
  table: downloadJobTable,
} = defineTable("download_job", {
  attempts: { column: "attempts", schema: Schema.Int },
  chapterId: { column: "chapter_id", nullable: true, schema: Schema.String },
  completedAt: {
    column: "completed_at",
    nullable: true,
    schema: Schema.Date,
  },
  createdAt: { column: "created_at", schema: Schema.Date },
  downloadDestinationId: {
    column: "download_destination_id",
    nullable: true,
    schema: Schema.String,
  },
  errorMessage: {
    column: "error_message",
    nullable: true,
    schema: Schema.String,
  },
  id: { column: "id", schema: Schema.String },
  leaseOwner: {
    column: "lease_owner",
    nullable: true,
    schema: Schema.String,
  },
  leasedAt: { column: "leased_at", nullable: true, schema: Schema.Date },
  maxAttempts: { column: "max_attempts", schema: Schema.Int },
  progressPercent: { column: "progress_percent", schema: Schema.Int },
  seriesId: { column: "series_id", nullable: true, schema: Schema.String },
  startedAt: { column: "started_at", nullable: true, schema: Schema.Date },
  status: {
    column: "status",
    schema: Schema.Literals([
      "queued",
      "running",
      "retryableFailed",
      "completed",
      "cancelled",
    ]),
  },
  updatedAt: { column: "updated_at", schema: Schema.Date },
  userId: { column: "user_id", schema: Schema.String },
});

export const {
  row: downloadArtifactRow,
  columns: downloadArtifactColumns,
  table: downloadArtifactTable,
} = defineTable("download_artifact", {
  chapterId: { column: "chapter_id", nullable: true, schema: Schema.String },
  createdAt: { column: "created_at", schema: Schema.Date },
  downloadJobId: { column: "download_job_id", schema: Schema.String },
  fileSizeBytes: {
    column: "file_size_bytes",
    nullable: true,
    schema: Schema.Int,
  },
  id: { column: "id", schema: Schema.String },
  importedToKomgaAt: {
    column: "imported_to_komga_at",
    nullable: true,
    schema: Schema.Date,
  },
  outputPath: { column: "output_path", schema: Schema.String },
  packageFormat: { column: "package_format", schema: Schema.String },
  updatedAt: { column: "updated_at", schema: Schema.Date },
});
