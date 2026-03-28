import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type DiscoverResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.sources>["discover"]["get"]>
>["data"];

export type DiscoverSection = NonNullable<DiscoverResponse>[number];

export const useSourceDiscover = (sourceId: string | undefined, limit = 12) =>
  useQuery({
    enabled: Boolean(sourceId),
    queryKey: ["sourceDiscover", sourceId, limit],
    queryFn: async () => {
      if (!sourceId) {
        return [];
      }

      const { data, error } = await api.api.sources({ sourceId }).discover.get({
        query: { limit },
      });
      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
