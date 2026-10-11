import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { SourceSearchPage } from "@/lib/api";

export interface SourceSearchParams {
  enabled?: boolean;
  sourceId: string | undefined;
  query: string;
  filters: Record<string, unknown>;
  pageSize?: number;
}

const fetchSearchPage = async (
  sourceId: string,
  params: SourceSearchParams,
  page: number
): Promise<SourceSearchPage> =>
  await api.run((client) =>
    client.sources.search({
      params: { sourceId },
      payload: {
        filters: params.filters,
        page,
        pageSize: params.pageSize,
        query: params.query,
      },
    })
  );

export const useSourceSearch = (params: SourceSearchParams) =>
  useInfiniteQuery<
    SourceSearchPage,
    Error,
    InfiniteData<SourceSearchPage>,
    QueryKey,
    number
  >({
    enabled: Boolean(params.sourceId) && (params.enabled ?? true),
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      if (!params.sourceId) {
        throw new Error("A source must be selected before searching.");
      }

      return await fetchSearchPage(params.sourceId, params, pageParam);
    },
    queryKey: [
      "sourceSearch",
      params.sourceId,
      params.query,
      params.filters,
      params.pageSize,
    ],
  });
