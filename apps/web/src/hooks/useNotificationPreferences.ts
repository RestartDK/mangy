import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type NotificationPreferencesResponse = Awaited<
  ReturnType<typeof api.api.notifications.preferences.get>
>["data"];

export type NotificationPreferences =
  NonNullable<NotificationPreferencesResponse>;

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const { data, error } = await api.api.notifications.preferences.get();
      if (error) {
        throw error;
      }

      return data ?? { inAppEnabled: true, unreadCount: 0 };
    },
  });
