import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type SettingsResponse = Awaited<
  ReturnType<typeof api.api.settings.bootstrap.get>
>["data"];
export type SettingsBootstrap = NonNullable<SettingsResponse>;

export const useSettingsBootstrap = () =>
  useQuery({
    queryKey: ["settingsBootstrap"],
    queryFn: async () => {
      const { data, error } = await api.api.settings.bootstrap.get();
      if (error) {
        throw error;
      }

      return (
        data ?? {
          destinations: [],
          notifications: { inAppEnabled: true, unreadCount: 0 },
          profile: { name: "", email: "" },
        }
      );
    },
  });
