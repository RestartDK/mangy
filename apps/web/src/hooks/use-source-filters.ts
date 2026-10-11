import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { SourceFilterDefinition } from "@/lib/api";

export const useSourceFilters = (sourceId: string | undefined) =>
  useQuery({
    enabled: Boolean(sourceId),
    queryFn: async () => {
      if (!sourceId) {
        return [];
      }

      return await api.run((client) =>
        client.sources.getFilters({ params: { sourceId } })
      );
    },
    queryKey: ["sourceFilters", sourceId],
  });
