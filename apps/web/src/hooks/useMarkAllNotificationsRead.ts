import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } =
        await api.api.notifications["mark-all-read"].post();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async (result) => {
      toast.success(
        result?.updatedCount
          ? `${result.updatedCount} notifications marked as read`
          : "All notifications are already read"
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({
          queryKey: ["notificationPreferences"],
        }),
        queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update notifications"
      );
    },
  });
};
