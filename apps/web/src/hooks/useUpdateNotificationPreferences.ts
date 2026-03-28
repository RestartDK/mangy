import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type UpdateNotificationPreferencesPayload = NonNullable<
  Parameters<typeof api.api.notifications.preferences.patch>[0]
>;

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateNotificationPreferencesPayload) => {
      const { data, error } =
        await api.api.notifications.preferences.patch(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
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
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update notification settings"
      );
    },
  });
};
