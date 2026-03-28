import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers3, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { SectionShelf } from "@/components/section-shelf";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const activeSource =
    sourcesQuery.data?.find((source) => source.isEnabled) ??
    sourcesQuery.data?.[0];
  const discoverQuery = useSourceDiscover(activeSource?.id, 8);

  const isLoading = sourcesQuery.isLoading || discoverQuery.isLoading;
  const hasError = sourcesQuery.error || discoverQuery.error;

  return (
    <AppShell>
      <PageHeader
        action={
          <Button asChild>
            <Link to="/search">
              Go to search
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
        description="Browse a quick snapshot of what is available, then jump into search when you know what you want."
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
          description="No enabled sources are available right now, so there is nothing to browse yet."
          icon="library"
          title="No sources available"
        />
      )}

      {!isLoading && activeSource ? (
        <div className="page-grid">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              helper={activeSource.description}
              icon={<Layers3 className="size-4" />}
              label="Source"
              value={activeSource.name}
            />
            <MetricCard
              helper={
                activeSource.capabilities.supportsSearch
                  ? "Ready for direct title searches"
                  : "Search is not available for this source"
              }
              icon={<Search className="size-4" />}
              label="Search"
              value={
                activeSource.capabilities.supportsSearch
                  ? "Available"
                  : "Unavailable"
              }
            />
            <MetricCard
              helper={
                activeSource.capabilities.supportsFilters
                  ? "Source filters can refine results"
                  : "This source does not expose filters"
              }
              label="Filters"
              value={
                activeSource.capabilities.supportsFilters
                  ? "Available"
                  : "Unavailable"
              }
            />
          </div>

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
              description="This source is connected, but it is not returning browse sections right now."
              icon="search"
              title="Nothing to browse yet"
            />
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

const DiscoverSkeleton = () => {
  return (
    <div className="page-grid">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={String(index)} size="sm">
            <div className="space-y-3 px-4 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={String(index)}>
            <Skeleton className="aspect-[3/4] w-full" />
            <div className="space-y-3 px-4 pb-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
