import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Filter,
  Loader2,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferredSource } from "@/hooks/use-preferred-source";
import type { SourceFilterDefinition } from "@/hooks/use-source-filters";
import { useSourceFilters } from "@/hooks/use-source-filters";
import { useSourceSearch } from "@/hooks/use-source-search";
import { useSources } from "@/hooks/use-sources";
import { getErrorMessage, pluralize } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import {
  findSelectFilter,
  getActiveFilters,
  TOOLBAR_FILTER_KEYS,
  withoutFilter,
} from "@/lib/search-filters";

export const Route = createFileRoute("/search")({
  beforeLoad: requireAuth,
  component: SearchRouteComponent,
});

const SEARCH_DEBOUNCE_MS = 350;
const ASCENDING_VALUE_PATTERN = /^asc/i;
const DESCENDING_VALUE_PATTERN = /^desc/i;

const setFilterValue = (
  definition: SourceFilterDefinition,
  value: string | string[] | boolean | undefined
): Record<string, unknown> | null => {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return { [definition.key]: value };
  }

  if (Array.isArray(value)) {
    const defaults =
      definition.type === "multiSelect" ? (definition.defaultValue ?? []) : [];

    if (value.length === 0 && defaults.length === 0) {
      return null;
    }

    return { [definition.key]: value };
  }

  if (value === definition.defaultValue) {
    return null;
  }

  return { [definition.key]: value };
};

function SearchRouteComponent() {
  const sourcesQuery = useSources();
  const enabledSources = useMemo(
    () => (sourcesQuery.data ?? []).filter((source) => source.isEnabled),
    [sourcesQuery.data]
  );
  const { selectedSourceId: sourceId, setSelectedSourceId: setSourceId } =
    usePreferredSource(enabledSources);

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const filtersQuery = useSourceFilters(sourceId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [queryInput]);

  const definitions = useMemo(
    () => filtersQuery.data ?? [],
    [filtersQuery.data]
  );
  const drawerDefinitions = definitions.filter(
    (definition) => !TOOLBAR_FILTER_KEYS.has(definition.key)
  );
  const sortDefinition = findSelectFilter(definitions, "sort");
  const orderDefinition = findSelectFilter(definitions, "order");
  const activeFilters = getActiveFilters(filters, definitions);
  const sourceName =
    enabledSources.find((source) => source.id === sourceId)?.name ??
    "this source";
  const orderAscendingValue =
    orderDefinition?.options.find(
      (option) =>
        ASCENDING_VALUE_PATTERN.test(option.value) ||
        ASCENDING_VALUE_PATTERN.test(option.label)
    )?.value ?? orderDefinition?.options.at(0)?.value;
  const orderDescendingValue =
    orderDefinition?.options.find(
      (option) =>
        DESCENDING_VALUE_PATTERN.test(option.value) ||
        DESCENDING_VALUE_PATTERN.test(option.label)
    )?.value ?? orderDefinition?.options.at(1)?.value;
  const toolbarDefaults = useMemo(() => {
    const defaults: Record<string, unknown> = {};

    for (const definition of definitions) {
      if (!TOOLBAR_FILTER_KEYS.has(definition.key)) {
        continue;
      }
      if (typeof definition.defaultValue === "string") {
        defaults[definition.key] = definition.defaultValue;
      }
    }

    return defaults;
  }, [definitions]);
  const effectiveFilters = useMemo(
    () => ({ ...toolbarDefaults, ...filters }),
    [filters, toolbarDefaults]
  );
  const searchQuery = useSourceSearch({
    enabled: !filtersQuery.isLoading,
    filters: effectiveFilters,
    query,
    sourceId,
  });
  const isOrderAscending = Boolean(
    orderAscendingValue && effectiveFilters.order === orderAscendingValue
  );
  const results = searchQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = searchQuery.data?.pages.at(0)?.total ?? null;

  const applyFilterValue = (
    definition: SourceFilterDefinition,
    value: string | string[] | boolean | undefined
  ) => {
    setFilters((current) => {
      const patch = setFilterValue(definition, value);

      if (!patch) {
        const next = { ...current };
        delete next[definition.key];
        return next;
      }

      return { ...current, ...patch };
    });
  };

  let resultsLabel = pluralize(results.length, "series", "series");

  if (query) {
    resultsLabel = `${pluralize(total ?? results.length, "result")} for “${query}”`;
  }

  const showSkeleton = Boolean(sourceId) && searchQuery.isLoading;
  const showError = Boolean(searchQuery.error);

  if (!showSkeleton && searchQuery.isFetching) {
    resultsLabel = "Searching…";
  }

  return (
    <AppShell>
      <PageHeader title="Search" />

      {sourcesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load sources</AlertTitle>
          <AlertDescription>
            {getErrorMessage(sourcesQuery.error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {filtersQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load filters</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              filtersQuery.error,
              "Try another source or reload the page."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="panel focus-within:ring-ring/25 flex items-center gap-1 p-1.5 pl-3 focus-within:ring-2">
        <SearchIcon className="text-muted-foreground size-4 shrink-0" />
        <input
          aria-label="Search titles"
          autoComplete="off"
          className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder={`Search ${sourceName}`}
          value={queryInput}
        />
        {queryInput ? (
          <Button
            aria-label="Clear search"
            onClick={() => {
              setQueryInput("");
              setQuery("");
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
        <Button
          className="h-8"
          onClick={() => setIsFiltersOpen(true)}
          type="button"
          variant="outline"
        >
          <Filter className="size-3.5" />
          Filters
          {activeFilters.length > 0 ? (
            <span className="bg-brand text-brand-foreground ml-0.5 rounded-full px-1.5 text-xs font-medium">
              {activeFilters.length}
            </span>
          ) : null}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          onValueChange={(value) => {
            setSourceId(value);
            setFilters({});
          }}
          value={sourceId ?? ""}
        >
          <SelectTrigger
            aria-label="Source"
            className="h-8 w-auto min-w-32 border-0 bg-transparent px-2 text-xs dark:bg-transparent"
          >
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

        {sortDefinition ? (
          <Select
            onValueChange={(value) => applyFilterValue(sortDefinition, value)}
            value={
              (effectiveFilters[sortDefinition.key] as string | undefined) ??
              sortDefinition.defaultValue ??
              ""
            }
          >
            <SelectTrigger
              aria-label={sortDefinition.label}
              className="h-8 w-auto min-w-32 border-0 bg-transparent px-2 text-xs dark:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortDefinition.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {orderDefinition ? (
          <Button
            aria-label={isOrderAscending ? "Sort descending" : "Sort ascending"}
            className="h-8"
            onClick={() => {
              const nextValue = isOrderAscending
                ? orderDescendingValue
                : orderAscendingValue;
              if (nextValue) {
                applyFilterValue(orderDefinition, nextValue);
              }
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            {isOrderAscending ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {searchQuery.isFetching && !showSkeleton ? (
            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
          ) : null}
          <span className="meta">{resultsLabel}</span>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((active) => (
            <button
              className="border-border bg-card hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              key={`${active.key}:${active.value}`}
              onClick={() =>
                setFilters((current) => withoutFilter(current, active))
              }
              type="button"
            >
              {active.label}
              <X className="text-muted-foreground size-3" />
            </button>
          ))}
          <Button
            className="h-6"
            onClick={() => setFilters({})}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear all
          </Button>
        </div>
      ) : null}

      {showError ? (
        <Alert variant="destructive">
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>
            {getErrorMessage(searchQuery.error, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {showSkeleton ? <ResultGridSkeleton /> : null}

      {showSkeleton ||
      showError ||
      sourcesQuery.isLoading ||
      sourceId ? null : (
        <EmptyState
          description="No enabled sources are connected yet."
          icon="search"
          title="No source available"
        />
      )}

      {sourceId &&
      !(showSkeleton || showError || searchQuery.isFetching) &&
      results.length === 0 ? (
        <EmptyState
          action={
            activeFilters.length > 0 ? (
              <Button
                onClick={() => setFilters({})}
                size="sm"
                type="button"
                variant="outline"
              >
                Clear filters
              </Button>
            ) : undefined
          }
          description={
            query
              ? "Try a shorter title, a different spelling, or another source."
              : "This source returned nothing for the current filters."
          }
          icon="search"
          title={query ? `No matches for “${query}”` : "No series found"}
        />
      ) : null}

      {results.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((item) => (
              <SeriesCard
                item={item}
                key={`${item.sourceId}:${item.seriesId}`}
              />
            ))}
          </div>
          {searchQuery.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                disabled={searchQuery.isFetchingNextPage}
                onClick={() => searchQuery.fetchNextPage()}
                size="lg"
                type="button"
                variant="outline"
              >
                {searchQuery.isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <Sheet onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Narrow results before opening a series.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            {filtersQuery.error ? (
              <p className="meta pb-4">Filters are unavailable right now.</p>
            ) : (
              <FieldGroup className="gap-5 pb-4">
                {drawerDefinitions.map((definition) => (
                  <FilterField
                    definition={definition}
                    filters={filters}
                    key={definition.key}
                    onValueChange={applyFilterValue}
                  />
                ))}
                {drawerDefinitions.length === 0 ? (
                  <p className="meta">This source has no extra filters.</p>
                ) : null}
              </FieldGroup>
            )}
          </div>
          <SheetFooter className="flex-row justify-between gap-2">
            <Button
              disabled={activeFilters.length === 0}
              onClick={() => setFilters({})}
              type="button"
              variant="ghost"
            >
              Clear all
            </Button>
            <Button onClick={() => setIsFiltersOpen(false)} type="button">
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

interface FilterFieldProps {
  definition: SourceFilterDefinition;
  filters: Record<string, unknown>;
  onValueChange: (
    definition: SourceFilterDefinition,
    value: string | string[] | boolean | undefined
  ) => void;
}

const FilterField = ({
  definition,
  filters,
  onValueChange,
}: FilterFieldProps) => {
  if (definition.type === "multiSelect") {
    const selected = new Set(
      Array.isArray(filters[definition.key])
        ? (filters[definition.key] as string[])
        : (definition.defaultValue ?? [])
    );

    return (
      <Field className="gap-2">
        <FieldTitle id={`${definition.key}-label`}>
          {definition.label}
        </FieldTitle>
        <fieldset
          aria-labelledby={`${definition.key}-label`}
          className="flex flex-col gap-2 border-0 p-0"
        >
          {definition.options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2.5 text-sm"
              htmlFor={`${definition.key}-${option.value}`}
              key={option.value}
            >
              <Checkbox
                checked={selected.has(option.value)}
                id={`${definition.key}-${option.value}`}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked === true) {
                    next.add(option.value);
                  } else {
                    next.delete(option.value);
                  }
                  onValueChange(definition, Array.from(next));
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </Field>
    );
  }

  if (definition.type === "toggle") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          checked={
            filters[definition.key] === true ||
            (filters[definition.key] === undefined &&
              definition.defaultValue === true)
          }
          id={definition.key}
          onCheckedChange={(checked) =>
            onValueChange(definition, checked === true)
          }
        />
        <FieldLabel htmlFor={definition.key}>{definition.label}</FieldLabel>
      </Field>
    );
  }

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={definition.key}>{definition.label}</FieldLabel>
      <Select
        onValueChange={(value) => onValueChange(definition, value)}
        value={
          (filters[definition.key] as string | undefined) ??
          definition.defaultValue ??
          ""
        }
      >
        <SelectTrigger className="h-8 w-full" id={definition.key}>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          {definition.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription className="text-xs">
        Defaults to {definition.defaultValue ?? "Any"}.
      </FieldDescription>
    </Field>
  );
};

const ResultGridSkeleton = () => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {Array.from({ length: 10 }).map((_, index) => (
      <div className="flex flex-col gap-3" key={String(index)}>
        <Skeleton className="aspect-2/3 w-full rounded-lg" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);
