import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useRetryDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) =>
      await api.run((client) => client.downloads.retry({ params: { jobId } })),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to retry job"
      );
    },
    onSuccess: async () => {
      toast.success("Job returned to the queue");
      await queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });
};
