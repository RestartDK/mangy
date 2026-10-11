import { Atom } from "effect/reactivity";

import { ApiAtoms } from "@/atoms/client";

interface SeriesInput {
  seriesId: string;
  sourceId: string;
}

const seriesQueries = Atom.family((input: SeriesInput) => ({
  chapters: ApiAtoms.query("series", "getChapters", {
    params: { seriesId: input.seriesId },
    query: { sourceId: input.sourceId },
  }),
  detail: ApiAtoms.query("series", "get", {
    params: { seriesId: input.seriesId },
    query: { sourceId: input.sourceId },
  }),
}));

export const seriesChapters = (input: SeriesInput) =>
  seriesQueries(input).chapters;

export const seriesDetail = (input: SeriesInput) => seriesQueries(input).detail;

interface ChapterInput extends SeriesInput {
  chapterId: string;
}

export const chapterPages = Atom.family((input: ChapterInput) =>
  ApiAtoms.query("series", "getPages", {
    params: { chapterId: input.chapterId, seriesId: input.seriesId },
    query: { sourceId: input.sourceId },
  })
);
