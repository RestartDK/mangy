import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useRemoveLibrarySeries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { sourceId: string; seriesId: string }) =>
      await api.run((client) => client.library.removeSeries({ query: input })),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to remove series from library"
      );
    },
    onSuccess: async (_, variables) => {
      toast.success("Series removed from library");
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
