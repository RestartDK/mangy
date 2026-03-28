import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type EnqueueDownloadPayload = NonNullable<
  Parameters<typeof api.api.downloads.post>[0]
>;

export const useEnqueueDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: EnqueueDownloadPayload) => {
      const { data, error } = await api.api.downloads.post(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Chapter added to the queue");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["downloads"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to queue chapter"
      );
    },
  });
};
