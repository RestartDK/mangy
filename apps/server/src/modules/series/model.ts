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
  chapterNumber: z.string().nullable(),
  externalUrl: z.url().nullable(),
  isUnavailable: z.boolean(),
  pageCount: z.number().int().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  sourceOrder: z.string().nullable(),
  title: z.string().nullable(),
  translatedLanguage: z.string().nullable(),
  volumeNumber: z.string().nullable(),
});

export const sourcePageSchema = z.object({
  imageUrl: z.url(),
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
