import { Api, CurrentUser } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { SourcesService } from "./service";

export const SourcesApiLive = HttpApiBuilder.group(Api, "sources", (handlers) =>
  handlers.handleAll({
    discover: Effect.fn(function* discoverHandler({ params, query }) {
      yield* CurrentUser;
      return yield* Effect.promise(
        async () =>
          await SourcesService.getDiscover(params.sourceId, query.limit)
      );
    }),
    getFilters: Effect.fn(function* getFiltersHandler({ params }) {
      yield* CurrentUser;
      return yield* Effect.promise(
        async () => await SourcesService.getFilters(params.sourceId)
      );
    }),
    list: Effect.fn(function* listHandler() {
      yield* CurrentUser;
      return yield* Effect.promise(async () => await SourcesService.list());
    }),
    search: Effect.fn(function* searchHandler({ params, payload }) {
      yield* CurrentUser;
      return yield* Effect.promise(
        async () => await SourcesService.search(params.sourceId, payload)
      );
    }),
  })
);
