import { useQuery } from "@tanstack/react-query";

import { tracking } from "@/lib/api";

export type { TrackedSeries } from "@/lib/api";

export const useTracking = () =>
  useQuery({
    queryFn: async () => await tracking.run((client) => client.tracking.list()),
    queryKey: ["tracking"],
    refetchInterval: 5000,
  });
