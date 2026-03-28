import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import Loader from "@/components/loader";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { Button } from "@/components/ui/button";
import { useSeriesDetail } from "@/hooks/useSeriesDetail";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/series/$sourceId/$seriesId")({
  beforeLoad: requireAuth,
  component: SeriesDetailRouteComponent,
});

function SeriesDetailRouteComponent() {
  const { sourceId, seriesId } = Route.useParams();
  const { chapters, error, isLoading, series } = useSeriesDetail(
    sourceId,
    seriesId
  );

  return (
    <AppShell
      subtitle="Series metadata and chapters are fetched live from the adapter, then normalized and stored in Postgres for the rest of the app to build on."
      title={series?.title ?? "Series details"}
    >
      {isLoading ? <Loader /> : null}

      {error ? (
        <PlaceholderPanel
          description="This series could not be loaded right now. Check the source adapter or try again in a moment."
          eyebrow="Series"
          title="Unable to load this title"
        />
      ) : null}

      {series ? (
        <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
          <section className="panelSurface p-6">
            <div className="aspect-[3/4] overflow-hidden rounded-[24px] bg-secondary/70">
              {series.coverImageUrl ? (
                <img
                  alt={series.title}
                  className="size-full object-cover"
                  src={series.coverImageUrl}
                />
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {series.tags.slice(0, 6).map((tag: string) => (
                <span
                  className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-muted-foreground text-xs uppercase tracking-[0.14em]"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-5 text-muted-foreground text-sm">
              {series.description || "No description available yet."}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Button disabled size="lg" type="button">
                Queue downloads in Phase 5
              </Button>
              <Button disabled size="lg" type="button" variant="outline">
                Tracking in Phase 6
              </Button>
            </div>
          </section>

          <section className="panelSurface p-6">
            <div className="eyebrow">Chapter feed</div>
            <div className="mt-4 grid gap-3">
              {chapters.map((chapter) => (
                <article
                  className="rounded-[20px] border border-border/60 bg-background/70 p-4"
                  key={chapter.chapterId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-base">
                        {chapter.chapterNumber
                          ? `Chapter ${chapter.chapterNumber}`
                          : "Special chapter"}
                        {chapter.title ? ` - ${chapter.title}` : ""}
                      </div>
                      <div className="mt-1 text-muted-foreground text-sm">
                        {chapter.publishedAt
                          ? new Date(chapter.publishedAt).toLocaleString()
                          : "Publish date unavailable"}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {chapter.pageCount
                        ? `${chapter.pageCount} pages`
                        : "Page count unavailable"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
