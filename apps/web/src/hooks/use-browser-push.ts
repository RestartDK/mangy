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
    queryKey: ["browserPushClientState"],
    queryFn: getBrowserPushClientState,
    retry: false,
  });

export const useConnectCurrentBrowserPush = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vapidPublicKey }: { vapidPublicKey: string }) => {
      const subscription = await subscribeCurrentBrowserToPush(vapidPublicKey);
      const { data, error } = await api.api.settings.push.subscriptions.post({
        ...subscription,
        userAgent: navigator.userAgent,
      });
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Browser notifications enabled on this browser");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["browserPushClientState"] }),
        queryClient.invalidateQueries({ queryKey: ["browserPushSettings"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to connect this browser for notifications"
      );
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

      const { data, error } =
        await api.api.settings.push.subscriptions.remove.post({ endpoint });
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Browser notifications disabled on this browser");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["browserPushClientState"] }),
        queryClient.invalidateQueries({ queryKey: ["browserPushSettings"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to disconnect this browser"
      );
    },
  });
};
