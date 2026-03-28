import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const source = pgTable(
  "source",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    languageCode: text("language_code").default("multi").notNull(),
    websiteUrl: text("website_url").notNull(),
    description: text("description").notNull(),
    iconUrl: text("icon_url"),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    supportsPopular: boolean("supports_popular").default(false).notNull(),
    supportsLatest: boolean("supports_latest").default(false).notNull(),
    supportsTrending: boolean("supports_trending").default(false).notNull(),
    supportsSearch: boolean("supports_search").default(false).notNull(),
    supportsFilters: boolean("supports_filters").default(false).notNull(),
    supportsSeriesDetails: boolean("supports_series_details")
      .default(false)
      .notNull(),
    supportsChapterFeed: boolean("supports_chapter_feed")
      .default(false)
      .notNull(),
    supportsPageFetch: boolean("supports_page_fetch").default(false).notNull(),
    supportedLanguages: text("supported_languages")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("source_enabled_idx").on(table.isEnabled)]
);

export const series = pgTable(
  "series",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    canonicalUrl: text("canonical_url"),
    coverImageUrl: text("cover_image_url"),
    status: text("status").default("unknown").notNull(),
    originalLanguage: text("original_language"),
    latestChapter: text("latest_chapter"),
    contentRating: text("content_rating"),
    publicationDemographic: text("publication_demographic"),
    authorNames: text("author_names")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    artistNames: text("artist_names")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
    availableTranslatedLanguages: text("available_translated_languages")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    lastFetchedAt: timestamp("last_fetched_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("series_source_idx").on(table.sourceId),
    index("series_title_idx").on(table.title),
    uniqueIndex("series_source_external_idx").on(
      table.sourceId,
      table.externalId
    ),
  ]
);

export const chapter = pgTable(
  "chapter",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title"),
    chapterNumber: text("chapter_number"),
    volumeNumber: text("volume_number"),
    translatedLanguage: text("translated_language"),
    externalUrl: text("external_url"),
    sourceOrder: text("source_order"),
    pageCount: integer("page_count"),
    publishedAt: timestamp("published_at"),
    isUnavailable: boolean("is_unavailable").default(false).notNull(),
    isDownloaded: boolean("is_downloaded").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chapter_series_idx").on(table.seriesId),
    index("chapter_published_at_idx").on(table.publishedAt),
    uniqueIndex("chapter_series_external_idx").on(
      table.seriesId,
      table.externalId
    ),
  ]
);

export const chapterRelations = relations(chapter, ({ one }) => ({
  series: one(series, {
    fields: [chapter.seriesId],
    references: [series.id],
  }),
}));

export const sourceRelations = relations(source, ({ many }) => ({
  series: many(series),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  source: one(source, {
    fields: [series.sourceId],
    references: [source.id],
  }),
  chapters: many(chapter),
}));
