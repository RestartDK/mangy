import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { SourceSummary } from "@/lib/api";

export const useSources = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.sources.list()),
    queryKey: ["sources"],
  });
