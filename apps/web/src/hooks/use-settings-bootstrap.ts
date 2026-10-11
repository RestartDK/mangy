import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { SettingsBootstrap } from "@/lib/api";

export const useSettingsBootstrap = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.settings.bootstrap()),
    queryKey: ["settingsBootstrap"],
  });
