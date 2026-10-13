import { Schema } from "effect";
import { Model } from "effect/schema";

import {
  DownloadDestinationIdSchema,
  KomgaLibraryIdSchema,
  UserIdSchema,
} from "./ids";

export const downloadDestinationTable = "download_destination";

export class DownloadDestination extends Model.Class<DownloadDestination>(
  "DownloadDestination"
)({
  absolutePath: Schema.String,
  createdAt: Schema.Date,
  id: DownloadDestinationIdSchema,
  isDefault: Schema.Boolean,
  isEnabled: Schema.Boolean,
  komgaLibraryId: Schema.OptionFromNullOr(KomgaLibraryIdSchema),
  name: Schema.String,
  updatedAt: Schema.Date,
  userId: UserIdSchema,
}) {}

export const downloadDestinationColumns = {
  absolutePath: "absolute_path",
  createdAt: "created_at",
  id: "id",
  isDefault: "is_default",
  isEnabled: "is_enabled",
  komgaLibraryId: "komga_library_id",
  name: "name",
  updatedAt: "updated_at",
  userId: "user_id",
} as const satisfies Record<keyof typeof DownloadDestination.fields, string>;
