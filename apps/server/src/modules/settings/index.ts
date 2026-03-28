import { Elysia } from "elysia";

import { getSessionUser } from "@/lib/auth";
import { settingsBootstrapSchema, unauthorizedResponseSchema } from "./model";
import { SettingsService } from "./service";

export const settings = new Elysia({ prefix: "/api/settings" }).get(
  "/bootstrap",
  async ({ request, set }) => {
    const user = await getSessionUser(request);
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    return SettingsService.getBootstrap(user.id, {
      name: user.name,
      email: user.email,
    });
  },
  {
    response: {
      200: settingsBootstrapSchema,
      401: unauthorizedResponseSchema,
    },
  }
);
