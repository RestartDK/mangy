import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { NotificationItem } from "@/lib/api";

export const useNotifications = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.notifications.list()),
    queryKey: ["notifications"],
    refetchInterval: 5000,
  });
