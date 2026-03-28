import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/appShell";
import Loader from "@/components/loader";
import { PlaceholderPanel } from "@/components/placeholderPanel";
import { SeriesCard } from "@/components/seriesCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSourceFilters } from "@/hooks/useSourceFilters";
import { useSourceSearch } from "@/hooks/useSourceSearch";
import { useSources } from "@/hooks/useSources";
import { requireAuth } from "@/lib/requireAuth";

export const Route = createFileRoute("/search")({
  beforeLoad: requireAuth,
  component: SearchRouteComponent,
});

const searchFieldIds = {
  query: "search-query",
} as const;

function SearchRouteComponent() {
  const { data: sources, isLoading: isSourcesLoading } = useSources();
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const filtersQuery = useSourceFilters(sourceId);
  const searchMutation = useSourceSearch(sourceId);

  useEffect(() => {
    if (!sourceId && sources?.[0]) {
      setSourceId(sources[0].id);
    }
  }, [sourceId, sources]);

  return (
    <AppShell
      subtitle="Every filter comes from the source adapter, so the UI can stay generic while each catalog stays true to its own search model."
      title="Search the catalog"
    >
      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <section className="panelSurface p-6">
          <div className="eyebrow">Search controls</div>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Source</span>
              <select
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                onChange={(event) => {
                  setSourceId(event.target.value);
                  setFilters({});
                }}
                value={sourceId ?? ""}
              >
                {sourceId ? null : <option value="">Choose a source</option>}
                {sources?.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="grid gap-2 text-sm"
              htmlFor={searchFieldIds.query}
            >
              <span className="font-medium">Title or keyword</span>
              <Input
                id={searchFieldIds.query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="One Piece, dungeon, horror..."
                value={query}
              />
            </label>

            {filtersQuery.data?.map((filter) => {
              if (filter.type === "select") {
                return (
                  <label className="grid gap-2 text-sm" key={filter.key}>
                    <span className="font-medium">{filter.label}</span>
                    <select
                      className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                      onChange={(event) => {
                        setFilters((current) => ({
                          ...current,
                          [filter.key]: event.target.value,
                        }));
                      }}
                      value={
                        (filters[filter.key] as string | undefined) ??
                        filter.defaultValue ??
                        ""
                      }
                    >
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (filter.type === "multiSelect") {
                const selectedValues = new Set(
                  Array.isArray(filters[filter.key])
                    ? (filters[filter.key] as string[])
                    : (filter.defaultValue ?? [])
                );

                return (
                  <div className="grid gap-3 text-sm" key={filter.key}>
                    <span className="font-medium">{filter.label}</span>
                    <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-border/60 bg-background/70 p-3">
                      {filter.options.map((option) => (
                        <label
                          className="flex items-center gap-2"
                          key={option.value}
                        >
                          <input
                            checked={selectedValues.has(option.value)}
                            className="size-4 rounded border border-border"
                            onChange={(event) => {
                              const nextValues = new Set(selectedValues);
                              if (event.target.checked) {
                                nextValues.add(option.value);
                              } else {
                                nextValues.delete(option.value);
                              }

                              setFilters((current) => ({
                                ...current,
                                [filter.key]: Array.from(nextValues),
                              }));
                            }}
                            type="checkbox"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <label
                  className="flex items-center gap-3 text-sm"
                  key={filter.key}
                >
                  <input
                    checked={Boolean(
                      filters[filter.key] ?? filter.defaultValue ?? false
                    )}
                    className="size-4 rounded border border-border"
                    onChange={(event) => {
                      setFilters((current) => ({
                        ...current,
                        [filter.key]: event.target.checked,
                      }));
                    }}
                    type="checkbox"
                  />
                  <span>{filter.label}</span>
                </label>
              );
            })}

            <Button
              disabled={!sourceId || searchMutation.isPending}
              onClick={() => {
                searchMutation.mutate({
                  query,
                  filters,
                  page: 1,
                  pageSize: 12,
                });
              }}
              size="lg"
              type="button"
            >
              {searchMutation.isPending ? "Searching..." : "Search"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4">
          {isSourcesLoading || filtersQuery.isLoading ? <Loader /> : null}

          {searchMutation.data ? null : (
            <PlaceholderPanel
              description="Choose a source, adjust any filters you want, and run a search. Results are normalized through the adapter layer before the app stores them."
              eyebrow="Search results"
              title="Ready when you are"
            />
          )}

          {searchMutation.data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {searchMutation.data.items.map((item) => (
                <SeriesCard
                  item={item}
                  key={`${item.sourceId}:${item.seriesId}`}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
