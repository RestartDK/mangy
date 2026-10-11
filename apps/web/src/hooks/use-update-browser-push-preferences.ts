import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { UpdateBrowserPushPreferencesPayload } from "@/lib/api";

export const useUpdateBrowserPushPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateBrowserPushPreferencesPayload) =>
      await api.run((client) =>
        client.settings.updatePushPreferences({ payload: body })
      ),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update browser notification settings"
      );
    },
    onSuccess: async () => {
      toast.success("Browser notification settings updated");
      await queryClient.invalidateQueries({
        queryKey: ["browserPushSettings"],
      });
    },
  });
};
