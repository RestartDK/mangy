import { useQuery } from "@tanstack/react-query";

import { getServerOrigin } from "@/lib/server-origin";

export interface ChapterPage {
  imageUrl: string;
  index: number;
}

interface ChapterPagesResponse {
  pages: ChapterPage[];
}

const buildPagesUrl = (
  sourceId: string,
  seriesId: string,
  chapterId: string
): string => {
  const url = new URL(
    `/api/series/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(chapterId)}/pages`,
    getServerOrigin()
  );
  url.searchParams.set("sourceId", sourceId);
  return url.toString();
};

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      return payload.message;
    }
  } catch {
    // ignore malformed JSON payloads
  }

  return `Unable to load chapter pages (${response.status}).`;
};

export const useChapterPages = (
  sourceId: string | undefined,
  seriesId: string | undefined,
  chapterId: string | undefined
) => {
  const enabled = Boolean(sourceId && seriesId && chapterId);

  return useQuery({
    enabled,
    queryFn: async () => {
      if (!(sourceId && seriesId && chapterId)) {
        return [] as ChapterPage[];
      }

      const response = await fetch(
        buildPagesUrl(sourceId, seriesId, chapterId),
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const payload = (await response.json()) as ChapterPagesResponse;
      return payload.pages;
    },
    queryKey: ["chapterPages", sourceId, seriesId, chapterId],
  });
};
