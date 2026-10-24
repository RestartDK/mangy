import { Api, BadRequest, CurrentUser } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { SettingsService } from "./service";

const badRequest = (message: string) => (cause: unknown) =>
  new BadRequest({
    message: cause instanceof Error ? cause.message : message,
  });

export const SettingsApiLive = HttpApiBuilder.group(
  Api,
  "settings",
  (handlers) =>
    handlers.handleAll({
      bootstrap: Effect.fn(function* bootstrapHandler() {
        const { email, id, name } = yield* CurrentUser;
        return yield* Effect.promise(
          async () => await SettingsService.getBootstrap(id, { email, name })
        );
      }),
      createDestination: Effect.fn(function* createDestinationHandler({
        payload,
      }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to save destination"),
          try: async () =>
            await SettingsService.createDestination(userId, payload),
        });
      }),
      createKomgaDestination: Effect.fn(
        function* createKomgaDestinationHandler({ payload }) {
          const { id: userId } = yield* CurrentUser;
          return yield* Effect.tryPromise({
            catch: badRequest("Unable to save destination"),
            try: async () =>
              await SettingsService.createKomgaDestination(userId, payload),
          });
        }
      ),
      deleteDestination: Effect.fn(function* deleteDestinationHandler({
        params,
      }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to delete destination"),
          try: async () =>
            await SettingsService.deleteDestination(
              userId,
              params.destinationId
            ),
        });
      }),
      getKomgaLibraries: Effect.fn(function* getKomgaLibrariesHandler() {
        yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to list Komga libraries"),
          try: async () => await SettingsService.getKomgaLibraries(),
        });
      }),
      getPush: Effect.fn(function* getPushHandler() {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.promise(
          async () => await SettingsService.getBrowserPushSettings(userId)
        );
      }),
      removePushSubscription: Effect.fn(
        function* removePushSubscriptionHandler({ payload }) {
          const { id: userId } = yield* CurrentUser;
          return yield* Effect.tryPromise({
            catch: badRequest("Unable to remove this browser subscription"),
            try: async () =>
              await SettingsService.removePushSubscription(userId, payload),
          });
        }
      ),
      savePushSubscription: Effect.fn(function* savePushSubscriptionHandler({
        payload,
      }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to save this browser subscription"),
          try: async () =>
            await SettingsService.savePushSubscription(userId, payload),
        });
      }),
      sendTestPush: Effect.fn(function* sendTestPushHandler() {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to send a browser test notification"),
          try: async () => await SettingsService.sendTestBrowserPush(userId),
        });
      }),
      updatePushPreferences: Effect.fn(function* updatePushPreferencesHandler({
        payload,
      }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to update browser notification settings"),
          try: async () =>
            await SettingsService.updateBrowserPushPreferences(userId, payload),
        });
      }),
    })
);
