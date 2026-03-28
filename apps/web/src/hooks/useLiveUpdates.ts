import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getServerOrigin } from "@/lib/server-origin";

export const useLiveUpdates = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const eventSource = new EventSource(
      `${getServerOrigin()}/api/live/events`,
      {
        withCredentials: true,
      }
    );

    const handleState = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as {
        downloadsChanged: boolean;
        notificationsChanged: boolean;
        trackingChanged: boolean;
      };

      if (payload.downloadsChanged) {
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ["downloads"] }),
          queryClient.invalidateQueries({ queryKey: ["library"] }),
        ]).catch(() => undefined);
      }

      if (payload.trackingChanged) {
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ["tracking"] }),
          queryClient.invalidateQueries({ queryKey: ["library"] }),
          queryClient.invalidateQueries({ queryKey: ["librarySeriesState"] }),
        ]).catch(() => undefined);
      }

      if (payload.notificationsChanged) {
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ["notifications"] }),
          queryClient.invalidateQueries({
            queryKey: ["notificationPreferences"],
          }),
          queryClient.invalidateQueries({ queryKey: ["settingsBootstrap"] }),
        ]).catch(() => undefined);
      }
    };

    eventSource.addEventListener("state", handleState as EventListener);

    return () => {
      eventSource.removeEventListener("state", handleState as EventListener);
      eventSource.close();
    };
  }, [enabled, queryClient]);
};
