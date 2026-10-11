import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { EnqueueDownloadPayload } from "@/lib/api";

export const useEnqueueDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: EnqueueDownloadPayload) =>
      await api.run((client) => client.downloads.enqueue({ payload: body })),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to queue chapter"
      );
    },
    onSuccess: async () => {
      toast.success("Chapter added to the queue");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["downloads"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
      ]);
    },
  });
};
