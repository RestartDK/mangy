import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type LibrarySeriesStateResponse = Awaited<
  ReturnType<(typeof api.api.library)["series-state"]["get"]>
>["data"];

export type LibrarySeriesState = NonNullable<LibrarySeriesStateResponse>;

export const useLibrarySeriesState = (
  sourceId: string | undefined,
  seriesId: string | undefined
) =>
  useQuery({
    enabled: Boolean(sourceId && seriesId),
    queryFn: async () => {
      if (!(sourceId && seriesId)) {
        return null;
      }

      const { data, error } = await api.api.library["series-state"].get({
        query: {
          seriesId,
          sourceId,
        },
      });
      if (error) {
        throw error;
      }

      return data ?? null;
    },
    queryKey: ["librarySeriesState", sourceId, seriesId],
    refetchInterval: 5000,
  });
