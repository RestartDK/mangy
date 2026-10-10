import { Elysia } from "elysia";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";

import {
  badRequestResponseSchema,
  downloadJobParamsSchema,
  downloadJobSchema,
  enqueueDownloadBody,
  unauthorizedResponseSchema,
} from "./model";
import { DownloadsService } from "./service";

export const downloads = new Elysia({ prefix: "/api/downloads" })
  .get(
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
  )
  .post(
    "/",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await DownloadsService.enqueue(user.id, body);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Unable to enqueue download",
        };
      }
    },
    {
      body: enqueueDownloadBody,
      response: {
        200: downloadJobSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/:jobId/cancel",
    async ({ params, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await DownloadsService.cancel(user.id, params.jobId);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error ? error.message : "Unable to cancel job",
        };
      }
    },
    {
      params: downloadJobParamsSchema,
      response: {
        200: downloadJobSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/:jobId/retry",
    async ({ params, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await DownloadsService.retry(user.id, params.jobId);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error ? error.message : "Unable to retry job",
        };
      }
    },
    {
      params: downloadJobParamsSchema,
      response: {
        200: downloadJobSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  )
  .post(
    "/:jobId/prioritize",
    async ({ params, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        return await DownloadsService.prioritize(user.id, params.jobId);
      } catch (error) {
        set.status = 400;
        return {
          message:
            error instanceof Error ? error.message : "Unable to reorder job",
        };
      }
    },
    {
      params: downloadJobParamsSchema,
      response: {
        200: downloadJobSchema,
        400: badRequestResponseSchema,
        401: unauthorizedResponseSchema,
      },
    }
  );
