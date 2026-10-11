import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";

import {
  sourceDiscoverQuery,
  sourceDiscoverSectionSchema,
  sourceFilterSchema,
  sourceParamsSchema,
  sourceSchema,
  sourceSearchBody,
  sourceSeriesListSchema,
  unauthorizedResponseSchema,
} from "./model";
import { SourcesService } from "./service";

const getAuthenticatedUser = async (request: Request) =>
  await getSessionUser(request);

export const sources = new Elysia({ prefix: "/api/sources" })
  .get(
    "/",
    async ({ request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return await SourcesService.list();
    },
    {
      response: {
        200: z.array(sourceSchema),
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/:sourceId/filters",
    async ({ params, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return await SourcesService.getFilters(params.sourceId);
    },
    {
      params: sourceParamsSchema,
      response: {
        200: z.array(sourceFilterSchema),
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/:sourceId/discover",
    async ({ params, query, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return await SourcesService.getDiscover(params.sourceId, query.limit);
    },
    {
      params: sourceParamsSchema,
      query: sourceDiscoverQuery,
      response: {
        200: z.array(sourceDiscoverSectionSchema),
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/:sourceId/search",
    async ({ params, body, request, set }) => {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return await SourcesService.search(params.sourceId, body);
    },
    {
      body: sourceSearchBody,
      params: sourceParamsSchema,
      response: {
        200: sourceSeriesListSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
