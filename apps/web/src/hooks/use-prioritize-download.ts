import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const usePrioritizeDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await api.api
        .downloads({ jobId })
        .prioritize.post();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Job moved to the front");
      await queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to reorder job"
      );
    },
  });
};
