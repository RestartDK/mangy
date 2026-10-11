import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { TrackedSeries } from "@/lib/api";

export const useTracking = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.tracking.list()),
    queryKey: ["tracking"],
    refetchInterval: 5000,
  });
