import { Elysia } from "elysia";

import { getSessionUser } from "@/lib/auth";
import {
  badRequestResponseSchema,
  createDestinationBody,
  deleteDestinationResponseSchema,
  destinationParamsSchema,
  destinationSchema,
  settingsBootstrapSchema,
  unauthorizedResponseSchema,
} from "./model";
import { SettingsService } from "./service";

export const settings = new Elysia({ prefix: "/api/settings" })
  .get(
    "/bootstrap",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return SettingsService.getBootstrap(user.id, {
        email: user.email,
        name: user.name,
      });
    },
    {
      response: {
        200: settingsBootstrapSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/destinations",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.createDestination(user.id, body);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to save destination",
        };
      }
    },
    {
      body: createDestinationBody,
      response: {
        200: destinationSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .delete(
    "/destinations/:destinationId",
    async ({ params, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.deleteDestination(
          user.id,
          params.destinationId
        );
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to delete destination",
        };
      }
    },
    {
      params: destinationParamsSchema,
      response: {
        200: deleteDestinationResponseSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
