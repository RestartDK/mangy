import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { LibrarySeriesState } from "@/lib/api";

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

      return await api.run((client) =>
        client.library.getSeriesState({ query: { seriesId, sourceId } })
      );
    },
    queryKey: ["librarySeriesState", sourceId, seriesId],
    refetchInterval: 5000,
  });
