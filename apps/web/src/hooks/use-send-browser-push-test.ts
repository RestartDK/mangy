import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useSendBrowserPushTest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.api.settings.push.test.post();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async (data) => {
      toast.success(
        data?.deliveredCount === 1
          ? "Test notification sent"
          : `Test notification sent to ${data?.deliveredCount ?? 0} browsers`
      );
      await queryClient.invalidateQueries({ queryKey: ["browserPushSettings"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send a browser test notification"
      );
    },
  });
};
