import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getServerOrigin } from "@/lib/server-origin";

interface LiveUpdatePayload {
  downloadsChanged: boolean;
  notificationsChanged: boolean;
  trackingChanged: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseLiveUpdatePayload = (raw: string): LiveUpdatePayload => {
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed)) {
    return {
      downloadsChanged: false,
      notificationsChanged: false,
      trackingChanged: false,
    };
  }

  return {
    downloadsChanged: Boolean(parsed.downloadsChanged),
    notificationsChanged: Boolean(parsed.notificationsChanged),
    trackingChanged: Boolean(parsed.trackingChanged),
  };
};

const refreshQueries = async (
  queryClient: QueryClient,
  queryKeys: string[][]
) => {
  try {
    await Promise.all(
      queryKeys.map(async (queryKey) => {
        await queryClient.invalidateQueries({ queryKey });
      })
    );
  } catch {
    // A failed refetch is retried on the next live-update event.
  }
};

const handleState = async (event: Event, queryClient: QueryClient) => {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
    return;
  }

  const payload = parseLiveUpdatePayload(event.data);
  const queryKeys: string[][] = [];

  if (payload.downloadsChanged) {
    queryKeys.push(["downloads"], ["library"]);
  }

  if (payload.trackingChanged) {
    queryKeys.push(["tracking"], ["library"], ["librarySeriesState"]);
  }

  if (payload.notificationsChanged) {
    queryKeys.push(
      ["notifications"],
      ["notificationPreferences"],
      ["settingsBootstrap"]
    );
  }

  await refreshQueries(queryClient, queryKeys);
};

export const useLiveUpdates = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect((): (() => void) | undefined => {
    if (!enabled) {
      return undefined;
    }

    const eventSource = new EventSource(
      `${getServerOrigin()}/api/live/events`,
      {
        withCredentials: true,
      }
    );
    const listener = (event: Event) => {
      void handleState(event, queryClient);
    };

    eventSource.addEventListener("state", listener);

    return () => {
      eventSource.removeEventListener("state", listener);
      eventSource.close();
    };
  }, [enabled, queryClient]);
};
