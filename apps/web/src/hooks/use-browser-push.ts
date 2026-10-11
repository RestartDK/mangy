import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  getBrowserPushClientState,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
} from "@/lib/browser-push";

export const useBrowserPushClientState = () =>
  useQuery({
    queryFn: getBrowserPushClientState,
    queryKey: ["browserPushClientState"],
    retry: false,
  });

export const useConnectCurrentBrowserPush = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vapidPublicKey }: { vapidPublicKey: string }) => {
      const subscription = await subscribeCurrentBrowserToPush(vapidPublicKey);

      return await api.run((client) =>
        client.settings.savePushSubscription({
          payload: { ...subscription, userAgent: navigator.userAgent },
        })
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to connect this browser for notifications"
      );
    },
    onSuccess: async () => {
      toast.success("Browser notifications enabled on this browser");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["browserPushClientState"] }),
        queryClient.invalidateQueries({ queryKey: ["browserPushSettings"] }),
      ]);
    },
  });
};

export const useDisconnectCurrentBrowserPush = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeCurrentBrowserFromPush();
      if (!endpoint) {
        return null;
      }

      return await api.run((client) =>
        client.settings.removePushSubscription({ payload: { endpoint } })
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to disconnect this browser"
      );
    },
    onSuccess: async () => {
      toast.success("Browser notifications disabled on this browser");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["browserPushClientState"] }),
        queryClient.invalidateQueries({ queryKey: ["browserPushSettings"] }),
      ]);
    },
  });
};
