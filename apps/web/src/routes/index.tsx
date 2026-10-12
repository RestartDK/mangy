import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";

import { discoverIdle, sourceDiscover, sourcesQuery } from "@/atoms/sources";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionShelf } from "@/components/section-shelf";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCause } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

const DiscoverSkeleton = () => (
  <div className="page-grid">
    {Array.from({ length: 2 }).map((_, sectionIndex) => (
      <div className="page-section" key={String(sectionIndex)}>
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_card, cardIndex) => (
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
const DiscoverRouteComponent = () => {
  const sourcesResult = useAtomValue(sourcesQuery);
  const sources = Option.getOrElse(AsyncResult.value(sourcesResult), () => []);
  const activeSource = sources.find((source) => source.isEnabled) ?? null;
  const discoverResult = useAtomValue(
    activeSource === null
      ? discoverIdle
      : sourceDiscover({ limit: 10, sourceId: activeSource.id })
  );
  const sections = Option.getOrElse(
    AsyncResult.value(discoverResult),
    () => []
  );

  const isLoading =
    AsyncResult.isInitial(sourcesResult) ||
    AsyncResult.isInitial(discoverResult);
  const hasError = Option.orElse(AsyncResult.cause(sourcesResult), () =>
    AsyncResult.cause(discoverResult)
  );

  return (
    <AppShell>
      <PageHeader title="Discover" />

      {Option.isSome(hasError) ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load discovery</AlertTitle>
          <AlertDescription>
            {formatCause(hasError.value, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <DiscoverSkeleton /> : null}

      {isLoading || activeSource ? null : (
        <EmptyState
          description="No source is connected yet."
          icon="library"
          title="No source available"
        />
      )}

      {!isLoading && activeSource ? (
        <div className="page-grid">
          {sections.length > 0 ? (
            sections.map((section) => (
              <SectionShelf key={section.id} section={section} />
            ))
          ) : (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link to="/search">Search titles</Link>
                </Button>
              }
              description="The source returned no browse sections."
              icon="search"
              title="Nothing to browse"
            />
          )}
        </div>
      ) : null}
    </AppShell>
  );
};

export const Route = createFileRoute("/")({
  beforeLoad: requireAuth,
  component: DiscoverRouteComponent,
});
