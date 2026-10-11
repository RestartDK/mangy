import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type SeriesRoute = ReturnType<typeof api.api.series>;
type SeriesResponse = Awaited<ReturnType<SeriesRoute["get"]>>["data"];
type ChaptersResponse = Awaited<
  ReturnType<SeriesRoute["chapters"]["get"]>
>["data"];

export type SeriesDetail = NonNullable<SeriesResponse>;
export type SeriesChapter = NonNullable<ChaptersResponse>[number];

export const useSeriesDetail = (
  sourceId: string | undefined,
  seriesId: string | undefined
) => {
  const params = sourceId && seriesId ? { seriesId, sourceId } : undefined;

  const seriesQuery = useQuery({
    enabled: Boolean(params),
    queryFn: async () => {
      if (!params) {
        return null;
      }

      const { data, error } = await api.api
        .series({ seriesId: params.seriesId })
        .get({
          query: { sourceId: params.sourceId },
        });
      if (error) {
        throw error;
      }

      return data ?? null;
    },
    queryKey: ["seriesDetail", sourceId, seriesId],
  });

  const chaptersQuery = useQuery({
    enabled: Boolean(params),
    queryFn: async () => {
      if (!params) {
        return [];
      }

      const { data, error } = await api.api
        .series({ seriesId: params.seriesId })
        .chapters.get({
          query: { sourceId: params.sourceId },
        });
      if (error) {
        throw error;
      }

      return data ?? [];
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
