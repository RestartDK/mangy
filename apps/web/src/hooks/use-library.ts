import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type { LibraryItem } from "@/lib/api";

export const useLibrary = () =>
  useQuery({
    queryFn: async () => await api.run((client) => client.library.list()),
    queryKey: ["library"],
    refetchInterval: 5000,
  });
