import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { CreateDestinationPayload } from "@/lib/api";

export const useCreateDestination = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateDestinationPayload) =>
      await api.run((client) =>
        client.settings.createDestination({ payload: body })
      ),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save destination"
      );
    },
    onSuccess: async () => {
      toast.success("Destination saved");
      await queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] });
    },
  });
};
