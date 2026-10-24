import { Api, BadRequest, CurrentUser } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { LibraryService } from "./service";

const badRequest = (message: string) => (cause: unknown) =>
  new BadRequest({
    message: cause instanceof Error ? cause.message : message,
  });

export const makeLibraryApiLive = (trackingPollIntervalMs: string) =>
  HttpApiBuilder.group(Api, "library", (handlers) =>
    handlers.handleAll({
      getSeriesState: Effect.fn(function* getSeriesStateHandler({ query }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.promise(
          async () =>
            await LibraryService.getSeriesState(
              userId,
              query.sourceId,
              query.seriesId
            )
        );
      }),
      list: Effect.fn(function* listHandler() {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.promise(
          async () => await LibraryService.list(userId)
        );
      }),
      removeSeries: Effect.fn(function* removeSeriesHandler({ query }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to remove library series"),
          try: async () =>
            await LibraryService.removeSeries(
              userId,
              query.sourceId,
              query.seriesId
            ),
        });
      }),
      updateSeriesState: Effect.fn(function* updateSeriesStateHandler({
        payload,
      }) {
        const { id: userId } = yield* CurrentUser;
        return yield* Effect.tryPromise({
          catch: badRequest("Unable to update library state"),
          try: async () =>
            await LibraryService.updateSeriesState(
              userId,
              payload,
              trackingPollIntervalMs
            ),
        });
      }),
    })
  );
