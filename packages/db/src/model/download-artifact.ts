import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  ChapterIdSchema,
  DownloadArtifactIdSchema,
  DownloadJobIdSchema,
} from "./ids";

export const downloadArtifactTable = "download_artifact";

export class DownloadArtifact extends Model.Class<DownloadArtifact>(
  "DownloadArtifact"
)({
  chapterId: Schema.OptionFromNullOr(ChapterIdSchema),
  createdAt: Schema.Date,
  downloadJobId: DownloadJobIdSchema,
  fileSizeBytes: Schema.OptionFromNullOr(Schema.Int),
  id: DownloadArtifactIdSchema,
  importedToKomgaAt: Schema.OptionFromNullOr(Schema.Date),
  outputPath: Schema.String,
  packageFormat: Schema.String,
  updatedAt: Schema.Date,
}) {}

export const downloadArtifactColumns = {
  chapterId: "chapter_id",
  createdAt: "created_at",
  downloadJobId: "download_job_id",
  fileSizeBytes: "file_size_bytes",
  id: "id",
  importedToKomgaAt: "imported_to_komga_at",
  outputPath: "output_path",
  packageFormat: "package_format",
  updatedAt: "updated_at",
} as const satisfies Record<keyof typeof DownloadArtifact.fields, string>;
