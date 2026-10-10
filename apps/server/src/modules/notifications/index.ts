import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";

import {
  badRequestResponseSchema,
  markAllNotificationsReadSchema,
  notificationParamsSchema,
  notificationPreferencesSchema,
  notificationSchema,
  unauthorizedResponseSchema,
  updateNotificationPreferencesBody,
} from "./model";
import { NotificationsService } from "./service";

export const notifications = new Elysia({ prefix: "/api/notifications" })
  .get(
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
  )
  .get(
    "/preferences",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return NotificationsService.getPreferences(user.id);
    },
    {
      response: {
        200: notificationPreferencesSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .patch(
    "/preferences",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return NotificationsService.updatePreferences(user.id, body);
    },
    {
      body: updateNotificationPreferencesBody,
      response: {
        200: notificationPreferencesSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .patch(
    "/:notificationId/read",
    async ({ params, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await NotificationsService.markRead(
          user.id,
          params.notificationId
        );
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to update notification",
        };
      }
    },
    {
      params: notificationParamsSchema,
      response: {
        200: notificationSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/mark-all-read",
    async ({ request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      return NotificationsService.markAllRead(user.id);
    },
    {
      response: {
        200: markAllNotificationsReadSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
