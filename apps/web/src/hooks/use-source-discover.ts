import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { DiscoverSection } from "@/lib/api";

export const useSourceDiscover = (sourceId: string | undefined, limit = 12) =>
  useQuery({
    enabled: Boolean(sourceId),
    queryFn: async () => {
      if (!sourceId) {
        return [];
      }

      return await api.run((client) =>
        client.sources.discover({ params: { sourceId }, query: { limit } })
      );
    },
    queryKey: ["sourceDiscover", sourceId, limit],
  });
