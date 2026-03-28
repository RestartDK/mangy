import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type SourcesResponse = Awaited<ReturnType<typeof api.api.sources.get>>["data"];
export type SourceSummary = NonNullable<SourcesResponse>[number];

export const useSources = () =>
  useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await api.api.sources.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
