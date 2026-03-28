import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type TrackingResponse = Awaited<
  ReturnType<typeof api.api.tracking.get>
>["data"];
export type TrackedSeries = NonNullable<TrackingResponse>[number];

export const useTracking = () =>
  useQuery({
    queryKey: ["tracking"],
    queryFn: async () => {
      const { data, error } = await api.api.tracking.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
    refetchInterval: 5000,
  });
