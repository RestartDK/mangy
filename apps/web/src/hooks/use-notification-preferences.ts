import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { NotificationPreferences } from "@/lib/api";

export const useNotificationPreferences = () =>
  useQuery({
    queryFn: async () =>
      await api.run((client) => client.notifications.getPreferences()),
    queryKey: ["notificationPreferences"],
  });
