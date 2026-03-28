import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { trackedSeriesSchema, unauthorizedResponseSchema } from "./model";
import { TrackingService } from "./service";

export const tracking = new Elysia({ prefix: "/api/tracking" }).get(
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
);
