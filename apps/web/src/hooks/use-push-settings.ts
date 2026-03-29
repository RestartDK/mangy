import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type PushSettingsResponse = Awaited<
  ReturnType<typeof api.api.settings.push.get>
>["data"];

export type PushSettings = NonNullable<PushSettingsResponse>;

export const usePushSettings = () =>
  useQuery({
    queryKey: ["browserPushSettings"],
    queryFn: async () => {
      const { data, error } = await api.api.settings.push.get();
      if (error) {
        throw error;
      }

      return (
        data ?? {
          activeSubscriptionCount: 0,
          isConfigured: false,
          isEnabled: false,
          lastDeliveredAt: null,
          lastError: null,
          lastErrorAt: null,
          notifyOnDownloadCompleted: true,
          notifyOnDownloadFailed: true,
          notifyOnTrackedSeriesUpdate: true,
          notifyOnSystemWarning: true,
          vapidPublicKey: null,
        }
      );
    },
  });
