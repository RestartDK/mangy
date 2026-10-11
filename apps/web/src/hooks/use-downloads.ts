import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { DownloadItem } from "@/lib/api";

export const useDownloads = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.downloads.list()),
    queryKey: ["downloads"],
    refetchInterval: 2000,
  });
