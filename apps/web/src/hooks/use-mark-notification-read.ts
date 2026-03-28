import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await api.api
        .notifications({ notificationId })
        .read.patch();
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
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
