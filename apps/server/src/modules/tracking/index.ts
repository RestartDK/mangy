import { Api, CurrentUser, RefreshFailed } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { TrackingService } from "./service";

export const TrackingApiLive = HttpApiBuilder.group(
  Api,
  "tracking",
  (handlers) =>
    handlers.handleAll({
      list: Effect.fn(function* listHandler() {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.promise(
          async () => await TrackingService.list(userId)
        );
      }),
      refresh: Effect.fn(function* refreshHandler({ payload }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: (cause) =>
            new RefreshFailed({
              message:
                cause instanceof Error
                  ? cause.message
                  : "Unable to schedule a refresh",
            }),
          try: async () =>
            await TrackingService.requestRefresh(
              userId,
              payload.sourceId,
              payload.seriesId
            ),
        });
      }),
    })
);
