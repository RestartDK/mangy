import { z } from "zod";

export const seriesParamsSchema = z.object({
  seriesId: z.string(),
});

export const seriesSourceQuerySchema = z.object({
  sourceId: z.string(),
});

export const seriesChapterParamsSchema = z.object({
  chapterId: z.string(),
  seriesId: z.string(),
});

export const seriesPageParamsSchema = z.object({
  chapterId: z.string(),
  pageIndex: z.coerce.number().int().min(0),
  seriesId: z.string(),
});

export const chapterSchema = z.object({
  chapterId: z.string(),
  title: z.string().nullable(),
  chapterNumber: z.string().nullable(),
  volumeNumber: z.string().nullable(),
  translatedLanguage: z.string().nullable(),
  externalUrl: z.string().url().nullable(),
  sourceOrder: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  publishedAt: z.string().datetime().nullable(),
  isUnavailable: z.boolean(),
});

export const sourcePageSchema = z.object({
  imageUrl: z.string().url(),
  index: z.number().int().min(0),
});

export const sourcePageListSchema = z.object({
  pages: z.array(sourcePageSchema),
});

export const errorResponseSchema = z.object({
  message: z.string(),
});

export {
  sourceSeriesSchema,
  unauthorizedResponseSchema,
} from "../sources/model";
