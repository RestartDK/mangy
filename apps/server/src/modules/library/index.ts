import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { libraryItemSchema, unauthorizedResponseSchema } from "./model";
import { LibraryService } from "./service";

export const library = new Elysia({ prefix: "/api/library" }).get(
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
);
