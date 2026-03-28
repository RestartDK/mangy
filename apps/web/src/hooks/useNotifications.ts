import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type NotificationsResponse = Awaited<
  ReturnType<typeof api.api.notifications.get>
>["data"];
export type NotificationItem = NonNullable<NotificationsResponse>[number];

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await api.api.notifications.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
