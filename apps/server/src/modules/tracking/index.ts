import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";

import {
  badRequestResponseSchema,
  refreshTrackedSeriesBody,
  trackedSeriesSchema,
  unauthorizedResponseSchema,
} from "./model";
import { TrackingService } from "./service";

export const tracking = new Elysia({ prefix: "/api/tracking" })
  .get(
    "/",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return TrackingService.list(user.id);
    },
    {
      response: {
        200: z.array(trackedSeriesSchema),
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/refresh",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await TrackingService.requestRefresh(
          user.id,
          body.sourceId,
          body.seriesId
        );
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to schedule a refresh",
        };
      }
    },
    {
      body: refreshTrackedSeriesBody,
      response: {
        200: trackedSeriesSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
