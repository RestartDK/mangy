import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

type UpdateBrowserPushPreferencesPayload = NonNullable<
  Parameters<typeof api.api.settings.push.preferences.patch>[0]
>;

export const useUpdateBrowserPushPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateBrowserPushPreferencesPayload) => {
      const { data, error } =
        await api.api.settings.push.preferences.patch(body);
      if (error) {
        throw new Error(error.value.message);
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Browser notification settings updated");
      await queryClient.invalidateQueries({
        queryKey: ["browserPushSettings"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update browser notification settings"
      );
    },
  });
};
