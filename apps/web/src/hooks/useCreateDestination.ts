import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type CreateDestinationPayload = NonNullable<
  Parameters<typeof api.api.settings.destinations.post>[0]
>;

export const useCreateDestination = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateDestinationPayload) => {
      const { data, error } = await api.api.settings.destinations.post(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Destination saved");
      await queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save destination"
      );
    },
  });
};
