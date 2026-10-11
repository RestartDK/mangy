import { Api } from "@mangy/contract";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { currentUser } from "@/lib/auth";

import { SourcesService } from "./service";

export const SourcesApiLive = HttpApiBuilder.group(Api, "sources", (handlers) =>
  handlers.handleAll({
    discover: Effect.fn(function* discoverHandler({ params, query }) {
      yield* currentUser;
      return yield* Effect.promise(
        async () =>
          await SourcesService.getDiscover(params.sourceId, query.limit)
      );
    }),
    getFilters: Effect.fn(function* getFiltersHandler({ params }) {
      yield* currentUser;
      return yield* Effect.promise(
        async () => await SourcesService.getFilters(params.sourceId)
      );
    }),
    list: Effect.fn(function* listHandler() {
      yield* currentUser;
      return yield* Effect.promise(async () => await SourcesService.list());
    }),
    search: Effect.fn(function* searchHandler({ params, payload }) {
      yield* currentUser;
      return yield* Effect.promise(
        async () => await SourcesService.search(params.sourceId, payload)
      );
    }),
  })
);
