import { Api, BadRequest } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { currentUser } from "@/lib/auth";

import { DownloadsService } from "./service";

const badRequest = (message: string) => (cause: unknown) =>
  new BadRequest({
    message: cause instanceof Error ? cause.message : message,
  });

export const DownloadsApiLive = HttpApiBuilder.group(
  Api,
  "downloads",
  (handlers) =>
    handlers.handleAll({
      cancel: Effect.fn(function* cancelHandler({ params }) {
        const userId = yield* currentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to cancel job"),
          try: async () => await DownloadsService.cancel(userId, params.jobId),
        });
      }),
      enqueue: Effect.fn(function* enqueueHandler({ payload }) {
        const userId = yield* currentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to enqueue download"),
          try: async () => await DownloadsService.enqueue(userId, payload),
        });
      }),
      list: Effect.fn(function* listHandler() {
        const userId = yield* currentUser;
        return yield* Effect.promise(
          async () => await DownloadsService.list(userId)
        );
      }),
      retry: Effect.fn(function* retryHandler({ params }) {
        const userId = yield* currentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to retry job"),
          try: async () => await DownloadsService.retry(userId, params.jobId),
        });
      }),
    })
);
