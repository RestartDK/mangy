import { Atom } from "effect/reactivity";

import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { LibraryItem } from "@mangy/contract";

export const libraryQuery = ApiAtoms.query("library", "list", {
  reactivityKeys: [reactivityKey.library],
});

interface LibrarySeriesInput {
  seriesId: string;
  sourceId: string;
}

export const librarySeriesState = Atom.family((input: LibrarySeriesInput) =>
  ApiAtoms.query("library", "getSeriesState", {
    query: input,
    reactivityKeys: [reactivityKey.librarySeriesState],
  })
);

export const removeLibrarySeries = ApiAtoms.mutation("library", "removeSeries");

export const updateLibrarySeriesState = ApiAtoms.mutation(
  "library",
  "updateSeriesState"
);
