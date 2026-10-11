import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { SeriesDetail, SeriesChapter } from "@/lib/api";

export const useSeriesDetail = (
  sourceId: string | undefined,
  seriesId: string | undefined
) => {
  const params =
    sourceId === undefined || seriesId === undefined
      ? undefined
      : { seriesId, sourceId };

  const seriesQuery = useQuery({
    enabled: params !== undefined,
    queryFn: async () => {
      if (params === undefined) {
        return null;
      }

      return await api.run((client) =>
        client.series.get({
          params: { seriesId: params.seriesId },
          query: { sourceId: params.sourceId },
        })
      );
    },
    queryKey: ["seriesDetail", sourceId, seriesId],
  });

  const chaptersQuery = useQuery({
    enabled: params !== undefined,
    queryFn: async () => {
      if (params === undefined) {
        return [];
      }

      return await api.run((client) =>
        client.series.getChapters({
          params: { seriesId: params.seriesId },
          query: { sourceId: params.sourceId },
        })
      );
    },
    queryKey: ["seriesChapters", sourceId, seriesId],
  });

  return {
    chapters: chaptersQuery.data ?? [],
    error: seriesQuery.error ?? chaptersQuery.error,
    isLoading: seriesQuery.isLoading || chaptersQuery.isLoading,
    series: seriesQuery.data,
  };
};
