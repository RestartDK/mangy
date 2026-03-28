import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useCancelDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await api.api.downloads({ jobId }).cancel.post();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Job cancelled");
      await queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel job"
      );
    },
  });
};
