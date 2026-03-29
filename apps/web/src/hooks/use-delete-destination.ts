import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useDeleteDestination = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (destinationId: string) => {
      const { data, error } = await api.api.settings
        .destinations({ destinationId })
        .delete();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Destination removed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
        queryClient.invalidateQueries({ queryKey: ["librarySeriesState"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove destination"
      );
    },
  });
};
