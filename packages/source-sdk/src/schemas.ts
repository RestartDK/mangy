import { Schema } from "effect";

/**
 * Schemas for the parsed domain values that adapters extract from third-party
 * HTML. These describe the in-process shape (real `Date` instances, `null`
 * unions) and are deliberately different from the HTTP wire schemas in
 * `@mangy/contract`, which encode dates as ISO strings and use `Option`.
 */

export const sourceSeriesStatusSchema = Schema.Literals([
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
  "unknown",
]);

export const sourceFilterOptionSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
});

export const sourceFilterSchema = Schema.Union([
  Schema.Struct({
    defaultValue: Schema.optional(Schema.String),
    key: Schema.String,
    label: Schema.String,
    options: Schema.mutable(Schema.Array(sourceFilterOptionSchema)),
    type: Schema.Literal("select"),
  }),
  Schema.Struct({
    defaultValue: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
    key: Schema.String,
    label: Schema.String,
    options: Schema.mutable(Schema.Array(sourceFilterOptionSchema)),
    type: Schema.Literal("multiSelect"),
  }),
  Schema.Struct({
    defaultValue: Schema.optional(Schema.Boolean),
    key: Schema.String,
    label: Schema.String,
    type: Schema.Literal("toggle"),
  }),
]);

export const sourceSeriesSchema = Schema.Struct({
  artistNames: Schema.mutable(Schema.Array(Schema.String)),
  authorNames: Schema.mutable(Schema.Array(Schema.String)),
  availableTranslatedLanguages: Schema.mutable(Schema.Array(Schema.String)),
  canonicalUrl: Schema.NullOr(Schema.String),
  contentRating: Schema.NullOr(Schema.String),
  coverImageUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  externalId: Schema.NonEmptyString,
  latestChapter: Schema.NullOr(Schema.String),
  originalLanguage: Schema.NullOr(Schema.String),
  publicationDemographic: Schema.NullOr(Schema.String),
  status: sourceSeriesStatusSchema,
  tags: Schema.mutable(Schema.Array(Schema.String)),
  title: Schema.NonEmptyString,
});

export const sourceChapterSchema = Schema.Struct({
  chapterNumber: Schema.NullOr(Schema.String),
  externalId: Schema.NonEmptyString,
  externalUrl: Schema.NullOr(Schema.String),
  isUnavailable: Schema.Boolean,
  pageCount: Schema.NullOr(Schema.Int),
  publishedAt: Schema.NullOr(Schema.Date),
  sourceOrder: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  translatedLanguage: Schema.NullOr(Schema.String),
  volumeNumber: Schema.NullOr(Schema.String),
});

export const sourcePageSchema = Schema.Struct({
  // `headers` and `referer` are genuinely absent for sources that do not need
  // them, and the rest of the codebase treats absence as "no header"; keeping
  // them optional rather than `Option` preserves the exported shape.
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  imageUrl: Schema.NonEmptyString,
  index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  referer: Schema.optional(Schema.String),
});

export const sourcePageListSchema = Schema.Struct({
  pages: Schema.mutable(Schema.Array(sourcePageSchema)),
});

export const sourceListResponseSchema = <ItemSchema extends Schema.Constraint>(
  item: ItemSchema
) =>
  Schema.Struct({
    hasNextPage: Schema.Boolean,
    items: Schema.mutable(Schema.Array(item)),
    page: Schema.Int,
    pageSize: Schema.Int,
    total: Schema.NullOr(Schema.Int),
  });

export const decodeSourceSeries = (value: unknown) =>
  Schema.decodeUnknownSync(sourceSeriesSchema)(value);

export const decodeSourceChapter = (value: unknown) =>
  Schema.decodeUnknownSync(sourceChapterSchema)(value);

export const decodeSourcePageList = (value: unknown) =>
  Schema.decodeUnknownSync(sourcePageListSchema)(value);

export const decodeSourceFilterDefinitions = (value: unknown) =>
  Schema.decodeUnknownSync(Schema.Array(sourceFilterSchema))(value);

export const decodeSourceListResponse = (value: unknown) =>
  Schema.decodeUnknownSync(sourceListResponseSchema(sourceSeriesSchema))(value);
