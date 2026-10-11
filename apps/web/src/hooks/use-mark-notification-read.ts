import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) =>
      await api.run((client) =>
        client.notifications.markRead({ params: { notificationId } })
      ),
    onSuccess: async () => {
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
