import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionShelf } from "@/components/section-shelf";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferredSource } from "@/hooks/use-preferred-source";
import { useSourceDiscover } from "@/hooks/use-source-discover";
import { useSources } from "@/hooks/use-sources";
import { getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/")({
  beforeLoad: requireAuth,
  component: DiscoverRouteComponent,
});

function DiscoverRouteComponent() {
  const sourcesQuery = useSources();
  const enabledSources = useMemo(
    () => (sourcesQuery.data ?? []).filter((source) => source.isEnabled),
    [sourcesQuery.data]
  );
  const { selectedSourceId, setSelectedSourceId } =
    usePreferredSource(enabledSources);

  const activeSource =
    enabledSources.find((source) => source.id === selectedSourceId) ?? null;
  const discoverQuery = useSourceDiscover(activeSource?.id, 10);

  const isLoading = sourcesQuery.isLoading || discoverQuery.isLoading;
  const hasError = sourcesQuery.error || discoverQuery.error;

  return (
    <AppShell>
      <PageHeader
        action={
          <Select
            onValueChange={setSelectedSourceId}
            value={activeSource?.id ?? undefined}
          >
            <SelectTrigger aria-label="Source" className="h-8 w-full sm:w-48">
              <SelectValue placeholder="Choose a source" />
            </SelectTrigger>
            <SelectContent>
              {enabledSources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        title="Discover"
      />

      {hasError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load discovery</AlertTitle>
          <AlertDescription>
            {getErrorMessage(hasError, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <DiscoverSkeleton /> : null}

      {isLoading || activeSource ? null : (
        <EmptyState
          description="No source is enabled right now."
          icon="library"
          title="No sources available"
        />
      )}

      {!isLoading && activeSource ? (
        <div className="page-grid">
          {discoverQuery.data?.length ? (
            discoverQuery.data.map((section) => (
              <SectionShelf key={section.id} section={section} />
            ))
          ) : (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link to="/search">Search this source</Link>
                </Button>
              }
              description="This source is connected but returned no browse sections."
              icon="search"
              title="Nothing to browse"
            />
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

const DiscoverSkeleton = () => (
  <div className="page-grid">
    {Array.from({ length: 2 }).map((_, sectionIndex) => (
      <div className="page-section" key={String(sectionIndex)}>
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, cardIndex) => (
            <div className="flex flex-col gap-3" key={String(cardIndex)}>
              <Skeleton className="aspect-2/3 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
