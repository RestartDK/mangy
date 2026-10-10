import { Elysia } from "elysia";

import { getSessionUser } from "@/lib/auth";

import {
  badRequestResponseSchema,
  browserPushSettingsSchema,
  browserPushTestResponseSchema,
  createDestinationBody,
  deleteDestinationResponseSchema,
  destinationParamsSchema,
  destinationSchema,
  removePushSubscriptionBody,
  savePushSubscriptionBody,
  settingsBootstrapSchema,
  unauthorizedResponseSchema,
  updateBrowserPushPreferencesBody,
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
  .get(
    "/push",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return SettingsService.getBrowserPushSettings(user.id);
    },
    {
      response: {
        200: browserPushSettingsSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .patch(
    "/push/preferences",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.updateBrowserPushPreferences(
          user.id,
          body
        );
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to update browser notification settings",
        };
      }
    },
    {
      body: updateBrowserPushPreferencesBody,
      response: {
        200: browserPushSettingsSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/push/subscriptions",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.savePushSubscription(user.id, body);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to save this browser subscription",
        };
      }
    },
    {
      body: savePushSubscriptionBody,
      response: {
        200: browserPushSettingsSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/push/subscriptions/remove",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.removePushSubscription(user.id, body);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to remove this browser subscription",
        };
      }
    },
    {
      body: removePushSubscriptionBody,
      response: {
        200: browserPushSettingsSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/push/test",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await SettingsService.sendTestBrowserPush(user.id);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to send a browser test notification",
        };
      }
    },
    {
      response: {
        200: browserPushTestResponseSchema,
        400: badRequestResponseSchema,
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
