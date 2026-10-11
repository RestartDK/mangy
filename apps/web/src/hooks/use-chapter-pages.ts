import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface ChapterPage {
  imageUrl: string;
  index: number;
}

export const useChapterPages = (
  sourceId: string | undefined,
  seriesId: string | undefined,
  chapterId: string | undefined
) =>
  useQuery({
    enabled: Boolean(sourceId && seriesId && chapterId),
    queryFn: async (): Promise<readonly ChapterPage[]> => {
      if (!(sourceId && seriesId && chapterId)) {
        return [];
      }

      const { pages } = await api.run((client) =>
        client.series.getPages({
          params: { chapterId, seriesId },
          query: { sourceId },
        })
      );

      return pages;
    },
    queryKey: ["chapterPages", sourceId, seriesId, chapterId],
  });
