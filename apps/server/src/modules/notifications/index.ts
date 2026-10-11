import { Api, BadRequest } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { currentUser } from "@/lib/auth";

import { NotificationsService } from "./service";

export const NotificationsApiLive = HttpApiBuilder.group(
  Api,
  "notifications",
  (handlers) =>
    handlers.handleAll({
      getPreferences: Effect.fn(function* getPreferencesHandler() {
        const userId = yield* currentUser;
        return yield* Effect.promise(
          async () => await NotificationsService.getPreferences(userId)
        );
      }),
      list: Effect.fn(function* listHandler() {
        const userId = yield* currentUser;
        return yield* Effect.promise(
          async () => await NotificationsService.list(userId)
        );
      }),
      markAllRead: Effect.fn(function* markAllReadHandler() {
        const userId = yield* currentUser;
        return yield* Effect.promise(
          async () => await NotificationsService.markAllRead(userId)
        );
      }),
      markRead: Effect.fn(function* markReadHandler({ params }) {
        const userId = yield* currentUser;
        return yield* Effect.tryPromise({
          catch: (cause) =>
            new BadRequest({
              message:
                cause instanceof Error
                  ? cause.message
                  : "Unable to update notification",
            }),
          try: async () =>
            await NotificationsService.markRead(userId, params.notificationId),
        });
      }),
      updatePreferences: Effect.fn(function* updatePreferencesHandler({
        payload,
      }) {
        const userId = yield* currentUser;
        return yield* Effect.promise(
          async () =>
            await NotificationsService.updatePreferences(userId, payload)
        );
      }),
    })
);
