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
    queryKey: ["librarySeriesState", sourceId, seriesId],
    queryFn: async () => {
      if (!(sourceId && seriesId)) {
        return null;
      }

      const { data, error } = await api.api.library["series-state"].get({
        query: {
          sourceId,
          seriesId,
        },
      });
      if (error) {
        throw error;
      }

      return data ?? null;
    },
    refetchInterval: 5000,
  });
