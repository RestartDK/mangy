import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { downloadDestination } from "./library";
import { chapter, series } from "./sources";

export const downloadJobStatus = pgEnum("download_job_status", [
  "queued",
  "running",
  "retryableFailed",
  "completed",
  "cancelled",
]);

export const downloadJob = pgTable(
  "download_job",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: text("series_id").references(() => series.id, {
      onDelete: "set null",
    }),
    chapterId: text("chapter_id").references(() => chapter.id, {
      onDelete: "set null",
    }),
    downloadDestinationId: text("download_destination_id").references(
      () => downloadDestination.id,
      { onDelete: "set null" }
    ),
    status: downloadJobStatus("status").default("queued").notNull(),
    progressPercent: integer("progress_percent").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    leaseOwner: text("lease_owner"),
    leasedAt: timestamp("leased_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("download_job_user_idx").on(table.userId),
    index("download_job_status_idx").on(table.status),
  ]
);

export const downloadArtifact = pgTable(
  "download_artifact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    downloadJobId: text("download_job_id")
      .notNull()
      .references(() => downloadJob.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapter.id, {
      onDelete: "set null",
    }),
    outputPath: text("output_path").notNull(),
    packageFormat: text("package_format").default("folder").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    importedToKomgaAt: timestamp("imported_to_komga_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("download_artifact_job_idx").on(table.downloadJobId)]
);

export const downloadArtifactRelations = relations(
  downloadArtifact,
  ({ one }) => ({
    downloadJob: one(downloadJob, {
      fields: [downloadArtifact.downloadJobId],
      references: [downloadJob.id],
    }),
    chapter: one(chapter, {
      fields: [downloadArtifact.chapterId],
      references: [chapter.id],
    }),
  })
);

export const downloadJobRelations = relations(downloadJob, ({ one, many }) => ({
  user: one(user, {
    fields: [downloadJob.userId],
    references: [user.id],
  }),
  series: one(series, {
    fields: [downloadJob.seriesId],
    references: [series.id],
  }),
  chapter: one(chapter, {
    fields: [downloadJob.chapterId],
    references: [chapter.id],
  }),
  downloadDestination: one(downloadDestination, {
    fields: [downloadJob.downloadDestinationId],
    references: [downloadDestination.id],
  }),
  artifacts: many(downloadArtifact),
}));
