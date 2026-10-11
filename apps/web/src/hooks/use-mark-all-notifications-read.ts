import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      await api.run((client) => client.notifications.markAllRead()),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update notifications"
      );
    },
    onSuccess: async (result) => {
      toast.success(
        result.updatedCount
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
  });
};
