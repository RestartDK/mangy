import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { tracking } from "@/lib/api";

import { decodeRefreshTrackedSeries } from "../../../server/src/api/tracking";

export const useRefreshTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { seriesId: string; sourceId: string }) =>
      await tracking.run((client) =>
        client.tracking.refresh({
          payload: decodeRefreshTrackedSeries(body),
        })
      ),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to request a tracking refresh"
      );
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
  });
};
