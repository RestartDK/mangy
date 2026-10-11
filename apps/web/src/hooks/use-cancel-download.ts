import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useCancelDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) =>
      await api.run((client) => client.downloads.cancel({ params: { jobId } })),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel job"
      );
    },
    onSuccess: async () => {
      toast.success("Job cancelled");
      await queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });
};
