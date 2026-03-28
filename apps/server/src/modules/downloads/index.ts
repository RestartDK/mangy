import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { downloadJobSchema, unauthorizedResponseSchema } from "./model";
import { DownloadsService } from "./service";

export const downloads = new Elysia({ prefix: "/api/downloads" }).get(
  "/",
  async ({ request, set }) => {
    const user = await getSessionUser(request);
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    return DownloadsService.list(user.id);
  },
  {
    response: {
      200: z.array(downloadJobSchema),
      401: unauthorizedResponseSchema,
    },
  }
);
