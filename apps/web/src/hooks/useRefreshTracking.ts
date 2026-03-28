import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type RefreshTrackingPayload = NonNullable<
  Parameters<typeof api.api.tracking.refresh.post>[0]
>;

export const useRefreshTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: RefreshTrackingPayload) => {
      const { data, error } = await api.api.tracking.refresh.post(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async (_, variables) => {
      toast.success("Tracking refresh queued");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tracking"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({
          queryKey: [
            "librarySeriesState",
            variables.sourceId,
            variables.seriesId,
          ],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to request a tracking refresh"
      );
    },
  });
};
