import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceFilterDefinition } from "@/hooks/use-source-filters";
import { useSourceFilters } from "@/hooks/use-source-filters";
import { useSourceSearch } from "@/hooks/use-source-search";
import { useSources } from "@/hooks/use-sources";
import { getErrorMessage } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/search")({
  beforeLoad: requireAuth,
  component: SearchRouteComponent,
});

const searchFieldIds = {
  query: "search-query",
} as const;

const getEmptySelectValue = (key: string): string => `__empty__:${key}`;

const normalizeSelectValue = (
  key: string,
  value: string | undefined
): string | undefined => {
  if (!value || value === getEmptySelectValue(key)) {
    return undefined;
  }

  return value;
};

function SearchRouteComponent() {
  const sourcesQuery = useSources();
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const filtersQuery = useSourceFilters(sourceId);
  const searchMutation = useSourceSearch(sourceId);

  useEffect(() => {
    if (!sourceId && sourcesQuery.data?.[0]) {
      setSourceId(sourcesQuery.data[0].id);
    }
  }, [sourceId, sourcesQuery.data]);

  const selectedSource =
    sourcesQuery.data?.find((source) => source.id === sourceId) ?? null;
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      if (typeof value === "boolean") {
        return value;
      }

      return typeof value === "string" ? value.length > 0 : Boolean(value);
    }).length;
  }, [filters]);

  const hasSearched = searchMutation.data !== undefined;
  const resultCount =
    searchMutation.data?.total ?? searchMutation.data?.items.length ?? 0;
  const shouldShowResults =
    hasSearched && (searchMutation.data?.items.length ?? 0) > 0;
  const shouldShowEmptyResults =
    hasSearched && (searchMutation.data?.items.length ?? 0) === 0;
  const filtersError = filtersQuery.error;
  const searchError = searchMutation.error;

  const runSearch = () => {
    searchMutation.mutate({
      filters,
      page: 1,
      pageSize: 12,
      query,
    });
    setIsMobileFiltersOpen(false);
  };

  const resetFilters = () => {
    setFilters({});
    setQuery("");
  };

  const filterPanel = (
    <SearchFiltersPanel
      activeFilterCount={activeFilterCount}
      filters={filters}
      filtersQuery={filtersQuery.data ?? []}
      isSearching={searchMutation.isPending}
      onFiltersChange={setFilters}
      onQueryChange={setQuery}
      onReset={resetFilters}
      onSearch={runSearch}
      onSourceChange={(nextSourceId) => {
        setSourceId(nextSourceId);
        setFilters({});
      }}
      query={query}
      selectedSourceId={sourceId ?? ""}
      sources={sourcesQuery.data ?? []}
    />
  );

  return (
    <AppShell>
      <PageHeader
        action={
          <Sheet
            onOpenChange={setIsMobileFiltersOpen}
            open={isMobileFiltersOpen}
          >
            <SheetTrigger asChild>
              <Button className="md:hidden" variant="outline">
                <Filter className="size-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Search filters</SheetTitle>
                <SheetDescription>
                  Choose a source, refine your query, and run a search.
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 pt-0">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        }
        description="Choose a source, refine the results if needed, and jump straight into a series to queue chapters."
        title="Search"
      />

      {sourcesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load sources</AlertTitle>
          <AlertDescription>
            {getErrorMessage(sourcesQuery.error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {filtersError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load filters</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              filtersError,
              "Try another source or reload the page."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {searchError ? (
        <Alert variant="destructive">
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>
            {getErrorMessage(searchError, "Try another search in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">{filterPanel}</div>
        </aside>

        <section className="page-section min-w-0">
          {selectedSource ? (
            <Card size="sm">
              <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>Results</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {query
                      ? `Showing matches for "${query}"`
                      : "Showing the latest search for the selected source."}
                  </p>
                </div>
                <div className="text-right text-muted-foreground text-sm">
                  <div>{selectedSource.name}</div>
                  <div>{resultCount} items</div>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          {sourcesQuery.isLoading || filtersQuery.isLoading ? (
            <SearchSkeleton />
          ) : null}

          {sourcesQuery.isLoading || sourceId ? null : (
            <EmptyState
              description="No source is selected yet. Choose one to start searching."
              icon="search"
              title="Choose a source"
            />
          )}

          {!(
            hasSearched ||
            searchMutation.isPending ||
            sourcesQuery.isLoading
          ) && sourceId ? (
            <EmptyState
              description="Choose a source and search to see matching series here."
              icon="search"
              title="Ready to search"
            />
          ) : null}

          {searchMutation.isPending ? <ResultGridSkeleton /> : null}

          {shouldShowEmptyResults ? (
            <EmptyState
              description="No series matched this search. Try a broader title, a different source, or fewer filters."
              icon="search"
              title="No results found"
            />
          ) : null}

          {shouldShowResults ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {searchMutation.data?.items.map((item) => (
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

interface SearchFiltersPanelProps {
  activeFilterCount: number;
  filters: Record<string, unknown>;
  filtersQuery: SourceFilterDefinition[];
  isSearching: boolean;
  onFiltersChange: (value: Record<string, unknown>) => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onSearch: () => void;
  onSourceChange: (value: string) => void;
  query: string;
  selectedSourceId: string;
  sources: Array<{ id: string; name: string }>;
}

const SearchFiltersPanel = ({
  activeFilterCount,
  filters,
  filtersQuery,
  isSearching,
  onFiltersChange,
  onQueryChange,
  onReset,
  onSearch,
  onSourceChange,
  query,
  selectedSourceId,
  sources,
}: SearchFiltersPanelProps) => {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle>Filters</CardTitle>
        <p className="text-muted-foreground text-sm">
          Narrow the catalog before you open a series.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="search-source">Source</FieldLabel>
            <Select
              onValueChange={onSourceChange}
              value={selectedSourceId || undefined}
            >
              <SelectTrigger className="w-full" id="search-source">
                <SelectValue placeholder="Choose a source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={searchFieldIds.query}>
              Title or keyword
            </FieldLabel>
            <Input
              id={searchFieldIds.query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="One Piece, dungeon, romance..."
              value={query}
            />
            <FieldDescription>
              Search by title, keyword, or whatever the source supports.
            </FieldDescription>
          </Field>

          {filtersQuery.map((filter) => {
            if (filter.type === "select") {
              const currentValue = normalizeSelectValue(
                filter.key,
                (filters[filter.key] as string | undefined) ??
                  filter.defaultValue ??
                  undefined
              );

              return (
                <Field key={filter.key}>
                  <FieldLabel htmlFor={filter.key}>{filter.label}</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      const nextValue = normalizeSelectValue(filter.key, value);
                      const nextFilters = { ...filters };

                      if (nextValue === undefined) {
                        delete nextFilters[filter.key];
                      } else {
                        nextFilters[filter.key] = nextValue;
                      }

                      onFiltersChange({
                        ...nextFilters,
                      });
                    }}
                    value={currentValue}
                  >
                    <SelectTrigger className="w-full" id={filter.key}>
                      <SelectValue
                        placeholder={`Choose ${filter.label.toLowerCase()}`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options.map((option) => (
                        <SelectItem
                          key={`${filter.key}:${option.label}:${option.value}`}
                          value={
                            option.value || getEmptySelectValue(filter.key)
                          }
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            }

            if (filter.type === "multiSelect") {
              const selectedValues = new Set(
                Array.isArray(filters[filter.key])
                  ? (filters[filter.key] as string[])
                  : (filter.defaultValue ?? [])
              );

              return (
                <Field key={filter.key}>
                  <FieldTitle>{filter.label}</FieldTitle>
                  <div className="grid gap-2 rounded-lg border p-3">
                    {filter.options.map((option) => (
                      <div
                        className="flex items-center gap-3 text-sm"
                        key={option.value}
                      >
                        <Checkbox
                          checked={selectedValues.has(option.value)}
                          onCheckedChange={(checked) => {
                            const nextValues = new Set(selectedValues);
                            if (checked === true) {
                              nextValues.add(option.value);
                            } else {
                              nextValues.delete(option.value);
                            }

                            onFiltersChange({
                              ...filters,
                              [filter.key]: Array.from(nextValues),
                            });
                          }}
                        />
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                </Field>
              );
            }

            return (
              <Field
                className="rounded-lg border p-3"
                key={filter.key}
                orientation="horizontal"
              >
                <Checkbox
                  checked={Boolean(
                    filters[filter.key] ?? filter.defaultValue ?? false
                  )}
                  onCheckedChange={(checked) => {
                    onFiltersChange({
                      ...filters,
                      [filter.key]: checked === true,
                    });
                  }}
                />
                <div className="space-y-1">
                  <FieldTitle>{filter.label}</FieldTitle>
                  <FieldDescription>
                    Turn this on to narrow the results.
                  </FieldDescription>
                </div>
              </Field>
            );
          })}
        </FieldGroup>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            disabled={!selectedSourceId || isSearching}
            onClick={onSearch}
            type="button"
          >
            <SearchIcon className="size-4" />
            {isSearching ? "Searching..." : "Search"}
          </Button>
          <Button onClick={onReset} type="button" variant="outline">
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          {activeFilterCount > 0
            ? `${activeFilterCount} filters applied`
            : "No extra filters applied"}
        </p>
      </CardContent>
    </Card>
  );
};

const SearchSkeleton = () => (
  <Card>
    <CardContent className="space-y-4 py-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-32" />
    </CardContent>
  </Card>
);

const ResultGridSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <Card key={String(index)}>
        <Skeleton className="aspect-[3/4] w-full" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    ))}
  </div>
);
