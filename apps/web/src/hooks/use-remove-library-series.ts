import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useRemoveLibrarySeries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { sourceId: string; seriesId: string }) => {
      const { data, error } = await api.api.library["series-state"].delete(
        undefined,
        {
          query: input,
        }
      );
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
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
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to remove series from library"
      );
    },
  });
};
