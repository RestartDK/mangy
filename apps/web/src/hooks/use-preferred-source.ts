import { useCallback, useEffect, useState } from "react";

import type { SourceSummary } from "@/hooks/use-sources";

const PREFERRED_SOURCE_STORAGE_KEY = "mangy.preferred-source-id";

export const usePreferredSource = (sources: SourceSummary[]) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(
    undefined
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const storedSourceId = window.localStorage.getItem(
      PREFERRED_SOURCE_STORAGE_KEY
    );

    setSelectedSourceId(storedSourceId ?? undefined);
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!sources.length) {
      return;
    }

    const hasSelectedSource = sources.some(
      (source) => source.id === selectedSourceId
    );

    if (hasSelectedSource) {
      return;
    }

    const fallbackSourceId = sources[0]?.id;

    if (!fallbackSourceId) {
      return;
    }

    setSelectedSourceId(fallbackSourceId);
    window.localStorage.setItem(PREFERRED_SOURCE_STORAGE_KEY, fallbackSourceId);
  }, [hasHydrated, selectedSourceId, sources]);

  const updatePreferredSource = useCallback((nextSourceId: string) => {
    setSelectedSourceId(nextSourceId);
    window.localStorage.setItem(PREFERRED_SOURCE_STORAGE_KEY, nextSourceId);
  }, []);

  return {
    selectedSourceId,
    setSelectedSourceId: updatePreferredSource,
  };
};
