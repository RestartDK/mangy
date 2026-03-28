import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";

type SearchBody = Parameters<
  ReturnType<typeof api.api.sources>["search"]["post"]
>[0];
type SearchResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.sources>["search"]["post"]>
>["data"];

export type SourceSearchInput = SearchBody;
export type SourceSearchResult = NonNullable<SearchResponse>;

export const useSourceSearch = (sourceId: string | undefined) =>
  useMutation({
    mutationFn: async (input: SourceSearchInput) => {
      if (!sourceId) {
        throw new Error("A source must be selected before searching.");
      }

      const { data, error } = await api.api
        .sources({ sourceId })
        .search.post(input);
      if (error) {
        throw error;
      }

      return (
        data ?? {
          items: [],
          page: 1,
          pageSize: 12,
          total: null,
          hasNextPage: false,
        }
      );
    },
  });
