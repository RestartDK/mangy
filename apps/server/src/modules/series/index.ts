import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import {
  chapterSchema,
  errorResponseSchema,
  seriesChapterParamsSchema,
  seriesPageParamsSchema,
  seriesParamsSchema,
  seriesSourceQuerySchema,
  sourcePageListSchema,
  sourceSeriesSchema,
  unauthorizedResponseSchema,
} from "./model";
import { SeriesService, SeriesServiceError } from "./service";

const getAuthenticatedUser = async (request: Request) =>
  getSessionUser(request);

const handleSeriesError = (
  error: unknown,
  set: { status?: number | string }
) => {
  set.status = error instanceof SeriesServiceError ? error.status : 400;

  return {
    message:
      error instanceof Error ? error.message : "Unable to load series data",
  };
};

export const series = new Elysia({ prefix: "/api/series" })
  .get(
    "/:seriesId",
    async ({ params, query, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SeriesService.getSeries(query.sourceId, params.seriesId);
      } catch (error) {
        return handleSeriesError(error, set);
      }
    },
    {
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      response: {
        200: sourceSeriesSchema,
        400: errorResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/:seriesId/chapters",
    async ({ params, query, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SeriesService.getChapters(query.sourceId, params.seriesId);
      } catch (error) {
        return handleSeriesError(error, set);
      }
    },
    {
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      response: {
        200: z.array(chapterSchema),
        400: errorResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/:seriesId/chapters/:chapterId/pages",
    async ({ params, query, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SeriesService.getPages(
          query.sourceId,
          params.seriesId,
          params.chapterId,
          request.url
        );
      } catch (error) {
        return handleSeriesError(error, set);
      }
    },
    {
      params: seriesChapterParamsSchema,
      query: seriesSourceQuerySchema,
      response: {
        200: sourcePageListSchema,
        400: errorResponseSchema,
        401: unauthorizedResponseSchema,
        404: errorResponseSchema,
      },
    }
  )
  .get(
    "/:seriesId/chapters/:chapterId/pages/:pageIndex/image",
    async ({ params, query, set, request }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SeriesService.proxyPageImage(
          query.sourceId,
          params.chapterId,
          params.pageIndex
        );
      } catch (error) {
        return handleSeriesError(error, set);
      }
    },
    {
      params: seriesPageParamsSchema,
      query: seriesSourceQuerySchema,
    }
  );
