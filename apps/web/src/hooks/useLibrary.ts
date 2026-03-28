import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type LibraryResponse = Awaited<ReturnType<typeof api.api.library.get>>["data"];
export type LibraryItem = NonNullable<LibraryResponse>[number];

export const useLibrary = () =>
  useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const { data, error } = await api.api.library.get();
      if (error) {
        throw error;
      }

      return data ?? [];
    },
    refetchInterval: 5000,
  });
