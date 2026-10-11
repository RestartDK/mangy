import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useSendBrowserPushTest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      await api.run((client) => client.settings.sendTestPush()),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send a browser test notification"
      );
    },
    onSuccess: async (data) => {
      toast.success(
        data.deliveredCount === 1
          ? "Test notification sent"
          : `Test notification sent to ${data.deliveredCount} browsers`
      );
      await queryClient.invalidateQueries({
        queryKey: ["browserPushSettings"],
      });
    },
  });
};
