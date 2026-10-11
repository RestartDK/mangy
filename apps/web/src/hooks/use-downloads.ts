import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type DownloadsResponse = Awaited<
  ReturnType<typeof api.api.downloads.get>
>["data"];
export type DownloadItem = NonNullable<DownloadsResponse>[number];

export const useDownloads = () =>
  useQuery({
    queryFn: async () => {
      const { data, error } = await api.api.downloads.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
    queryKey: ["downloads"],
    refetchInterval: 2000,
  });
