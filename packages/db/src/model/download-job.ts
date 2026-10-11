import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  ChapterIdSchema,
  DownloadDestinationIdSchema,
  DownloadJobIdSchema,
  SeriesIdSchema,
  UserIdSchema,
} from "./ids";

export const downloadJobTable = "download_job";

export class DownloadJob extends Model.Class<DownloadJob>("DownloadJob")({
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
}) {}

export const downloadJobColumns = {
  attempts: "attempts",
  chapterId: "chapter_id",
  completedAt: "completed_at",
  createdAt: "created_at",
  downloadDestinationId: "download_destination_id",
  errorMessage: "error_message",
  id: "id",
  leaseOwner: "lease_owner",
  leasedAt: "leased_at",
  maxAttempts: "max_attempts",
  progressPercent: "progress_percent",
  seriesId: "series_id",
  startedAt: "started_at",
  status: "status",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof DownloadJob.fields, string>;
