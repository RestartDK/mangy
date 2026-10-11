import type {
  DiscoverSection,
  SourceFilterDefinition,
  SourceSeriesList,
} from "@mangy/contract";
import { Effect, Option, Stream } from "effect";
import { constVoid } from "effect/Function";
import { Atom, AsyncResult } from "effect/reactivity";

import { ApiAtoms } from "@/atoms/client";

export type { SourceSeries, SourceSummary } from "@mangy/contract";

export const sourcesQuery = ApiAtoms.query("sources", "list", {});

export const discoverIdle = Atom.make(
  AsyncResult.success<readonly DiscoverSection[]>([])
);

export const sourceFiltersIdle = Atom.make(
  AsyncResult.success<readonly SourceFilterDefinition[]>([])
);

interface SourceInput {
  sourceId: string;
}

export const sourceFilters = Atom.family(({ sourceId }: SourceInput) =>
  ApiAtoms.query("sources", "getFilters", { params: { sourceId } })
);

interface DiscoverInput extends SourceInput {
  limit: number;
}

export const sourceDiscover = Atom.family(
  ({ limit, sourceId }: DiscoverInput) =>
    ApiAtoms.query("sources", "discover", {
      params: { sourceId },
      query: { limit },
    })
);

interface SearchInput extends SourceInput {
  filters: Record<string, unknown>;
  pageSize?: number;
  query: string;
}

export const searchPages = Atom.family((input: SearchInput) =>
  ApiAtoms.runtime.pull(
    Stream.paginate(1, (page: number) =>
      Effect.gen(function* searchPageEffect() {
        const client = yield* ApiAtoms;
        const result = yield* client.sources.search({
          params: { sourceId: input.sourceId },
          payload: {
            filters: input.filters,
            page,
            pageSize: input.pageSize,
            query: input.query,
          },
        });
        const nextPage = result.hasNextPage
          ? Option.some(page + 1)
          : Option.none<number>();

        return [[result], nextPage] as const;
      })
    )
  )
);

const emptyPage: SourceSeriesList = {
  hasNextPage: false,
  items: [],
  page: 1,
  pageSize: 0,
  total: 0,
};

// A search that is not enabled yet reads as an empty first page, so the route keeps
// its loading, error and empty branches without a conditional hook.
export const searchIdle: ReturnType<typeof searchPages> = Atom.writable(
  () => AsyncResult.success({ done: true, items: [emptyPage] }),
  constVoid
);
