import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { UpdateNotificationPreferencesPayload } from "@/lib/api";

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateNotificationPreferencesPayload) =>
      await api.run((client) =>
        client.notifications.updatePreferences({ payload: body })
      ),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update notification settings"
      );
    },
    onSuccess: async () => {
      toast.success("Notification settings updated");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notificationPreferences"],
        }),
        queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] }),
      ]);
    },
  });
};
