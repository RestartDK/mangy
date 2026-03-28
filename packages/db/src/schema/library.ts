import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { series } from "./sources";

export const downloadDestination = pgTable(
  "download_destination",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    absolutePath: text("absolute_path").notNull(),
    komgaLibraryId: text("komga_library_id"),
    isDefault: boolean("is_default").default(false).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("download_destination_user_idx").on(table.userId)]
);

export const libraryEntry = pgTable(
  "library_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    downloadDestinationId: text("download_destination_id").references(
      () => downloadDestination.id,
      { onDelete: "set null" }
    ),
    isTracked: boolean("is_tracked").default(false).notNull(),
    autoDownload: boolean("auto_download").default(false).notNull(),
    lastOpenedChapterId: text("last_opened_chapter_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("library_entry_user_idx").on(table.userId),
    uniqueIndex("library_entry_user_series_idx").on(
      table.userId,
      table.seriesId
    ),
  ]
);

export const libraryEntryRelations = relations(
  libraryEntry,
  ({ one, many }) => ({
    user: one(user, {
      fields: [libraryEntry.userId],
      references: [user.id],
    }),
    series: one(series, {
      fields: [libraryEntry.seriesId],
      references: [series.id],
    }),
    downloadDestination: one(downloadDestination, {
      fields: [libraryEntry.downloadDestinationId],
      references: [downloadDestination.id],
    }),
    trackedSeriesStates: many(trackedSeriesState),
  })
);

export const trackedSeriesState = pgTable(
  "tracked_series_state",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    libraryEntryId: text("library_entry_id")
      .notNull()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),
    lastCheckedAt: timestamp("last_checked_at"),
    nextCheckAt: timestamp("next_check_at"),
    lastSeenChapterExternalId: text("last_seen_chapter_external_id"),
    checkFailureCount: integer("check_failure_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("tracked_series_library_idx").on(table.libraryEntryId)]
);

export const trackedSeriesStateRelations = relations(
  trackedSeriesState,
  ({ one }) => ({
    libraryEntry: one(libraryEntry, {
      fields: [trackedSeriesState.libraryEntryId],
      references: [libraryEntry.id],
    }),
  })
);

export const downloadDestinationRelations = relations(
  downloadDestination,
  ({ one, many }) => ({
    user: one(user, {
      fields: [downloadDestination.userId],
      references: [user.id],
    }),
    libraryEntries: many(libraryEntry),
  })
);
