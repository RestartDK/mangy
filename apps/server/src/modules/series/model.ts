import { z } from "zod";

import {
  sourceSeriesSchema,
  unauthorizedResponseSchema,
} from "../sources/model";

export const seriesParamsSchema = z.object({
  seriesId: z.string(),
});

export const seriesSourceQuerySchema = z.object({
  sourceId: z.string(),
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

export { sourceSeriesSchema, unauthorizedResponseSchema };
