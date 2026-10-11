import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { PushSettings } from "@/lib/api";

export const usePushSettings = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.settings.getPush()),
    queryKey: ["browserPushSettings"],
  });
