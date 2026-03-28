import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import {
  chapterSchema,
  seriesParamsSchema,
  seriesSourceQuerySchema,
  sourceSeriesSchema,
  unauthorizedResponseSchema,
} from "./model";
import { SeriesService } from "./service";

export const series = new Elysia({ prefix: "/api/series" })
  .get(
    "/:seriesId",
    async ({ params, query, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return SeriesService.getSeries(query.sourceId, params.seriesId);
    },
    {
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      response: {
        200: sourceSeriesSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/:seriesId/chapters",
    async ({ params, query, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return SeriesService.getChapters(query.sourceId, params.seriesId);
    },
    {
      params: seriesParamsSchema,
      query: seriesSourceQuerySchema,
      response: {
        200: z.array(chapterSchema),
        401: unauthorizedResponseSchema,
      },
    }
  );
