import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { SectionShelf } from "@/components/section-shelf";
import { useSourceDiscover } from "@/hooks/use-source-discover";
import { useSources } from "@/hooks/use-sources";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/")({
  beforeLoad: requireAuth,
  component: DiscoverRouteComponent,
});

function DiscoverRouteComponent() {
  const { data: sources, isLoading: isSourcesLoading } = useSources();
  const activeSource = sources?.[0];
  const { data: sections, isLoading: isDiscoverLoading } = useSourceDiscover(
    activeSource?.id,
    8
  );

  return (
    <AppShell
      subtitle="Start with a live source feed today, then expand into queueing, tracking, and Komga delivery as the engine grows."
      title="Your manga front page"
    >
      {isSourcesLoading || isDiscoverLoading ? <Loader /> : null}

      {isSourcesLoading || activeSource ? null : (
        <PlaceholderPanel
          description="No source adapters are enabled yet. Add a source adapter in the backend registry to start browsing."
          eyebrow="Discover"
          title="No live sources available"
        />
      )}

      {activeSource ? (
        <div className="grid gap-8">
          <PlaceholderPanel
            description={`Phase 3 is wired against ${activeSource.name}. The browsing engine is live, persisted in Postgres, and ready for more source adapters.`}
            eyebrow="Live source"
            title={`Catalog powered by ${activeSource.name}`}
          >
            <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                Popular: {String(activeSource.capabilities.supportsPopular)}
              </span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                Search: {String(activeSource.capabilities.supportsSearch)}
              </span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                Filters: {String(activeSource.capabilities.supportsFilters)}
              </span>
            </div>
          </PlaceholderPanel>

          {sections?.map((section) => (
            <SectionShelf key={section.id} section={section} />
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
