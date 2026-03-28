import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { notificationSchema, unauthorizedResponseSchema } from "./model";
import { NotificationsService } from "./service";

export const notifications = new Elysia({ prefix: "/api/notifications" }).get(
  "/",
  async ({ request, set }) => {
    const user = await getSessionUser(request);
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    return NotificationsService.list(user.id);
  },
  {
    response: {
      200: z.array(notificationSchema),
      401: unauthorizedResponseSchema,
    },
  }
);
