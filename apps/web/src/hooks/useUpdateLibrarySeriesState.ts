import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type UpdateLibrarySeriesStatePayload = NonNullable<
  Parameters<(typeof api.api.library)["series-state"]["patch"]>[0]
>;

export const useUpdateLibrarySeriesState = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateLibrarySeriesStatePayload) => {
      const { data, error } = await api.api.library["series-state"].patch(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
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
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update tracking settings"
      );
    },
  });
};
