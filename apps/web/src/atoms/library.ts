import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { LibraryItem } from "@mangy/contract";

export const libraryQuery = ApiAtoms.query("library", "list", {
  reactivityKeys: [reactivityKey.library],
});

export const removeLibrarySeries = ApiAtoms.mutation("library", "removeSeries");
