import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { UpdateLibrarySeriesStatePayload } from "@/lib/api";

export const useUpdateLibrarySeriesState = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateLibrarySeriesStatePayload) =>
      await api.run((client) =>
        client.library.updateSeriesState({ payload: body })
      ),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update tracking settings"
      );
    },
    onSuccess: async (_, variables) => {
      toast.success("Tracking settings updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["library"] }),
        queryClient.invalidateQueries({ queryKey: ["tracking"] }),
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
