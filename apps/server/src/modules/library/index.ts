import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import {
  badRequestResponseSchema,
  libraryItemSchema,
  librarySeriesQuerySchema,
  librarySeriesStateSchema,
  removeLibrarySeriesResponseSchema,
  unauthorizedResponseSchema,
  updateLibrarySeriesStateBody,
} from "./model";
import { LibraryService } from "./service";

export const library = new Elysia({ prefix: "/api/library" })
  .get(
    "/",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return LibraryService.list(user.id);
    },
    {
      response: {
        200: z.array(libraryItemSchema),
        401: unauthorizedResponseSchema,
      },
    }
  )
  .get(
    "/series-state",
    async ({ query, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return LibraryService.getSeriesState(
        user.id,
        query.sourceId,
        query.seriesId
      );
    },
    {
      query: librarySeriesQuerySchema,
      response: {
        200: librarySeriesStateSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .patch(
    "/series-state",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await LibraryService.updateSeriesState(user.id, body);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to update library state",
        };
      }
    },
    {
      body: updateLibrarySeriesStateBody,
      response: {
        200: librarySeriesStateSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .delete(
    "/series-state",
    async ({ query, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await LibraryService.removeSeries(
          user.id,
          query.sourceId,
          query.seriesId
        );
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to remove library series",
        };
      }
    },
    {
      query: librarySeriesQuerySchema,
      response: {
        200: removeLibrarySeriesResponseSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
