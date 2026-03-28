import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type FiltersResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.sources>["filters"]["get"]>
>["data"];

export type SourceFilterDefinition = NonNullable<FiltersResponse>[number];

export const useSourceFilters = (sourceId: string | undefined) =>
  useQuery({
    enabled: Boolean(sourceId),
    queryKey: ["sourceFilters", sourceId],
    queryFn: async () => {
      if (!sourceId) {
        return [];
      }

      const { data, error } = await api.api.sources({ sourceId }).filters.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
