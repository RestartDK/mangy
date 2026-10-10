import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type SearchResponse = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof api.api.sources>["search"]["post"]>
  >["data"]
>;

export type SourceSearchPage = SearchResponse;

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
): Promise<SourceSearchPage> => {
  const { data, error } = await api.api.sources({ sourceId }).search.post({
    filters: params.filters,
    page,
    pageSize: params.pageSize,
    query: params.query,
  });

  if (error) {
    throw error;
  }

  return (
    data ?? {
      items: [],
      page,
      pageSize: params.pageSize ?? 20,
      total: null,
      hasNextPage: false,
    }
  );
};

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
    queryFn: ({ pageParam }) => {
      if (!params.sourceId) {
        throw new Error("A source must be selected before searching.");
      }

      return fetchSearchPage(params.sourceId, params, pageParam);
    },
    queryKey: [
      "sourceSearch",
      params.sourceId,
      params.query,
      params.filters,
      params.pageSize,
    ],
  });
