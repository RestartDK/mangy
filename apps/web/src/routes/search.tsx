import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { SourceFilterDefinition } from "@mangy/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { ArrowDown, ArrowUp, Filter, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  searchIdle,
  searchPagesWithHistory,
  sourceFilters,
  sourceFiltersIdle,
  sourcesQuery,
} from "@/atoms/sources";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCause, hasText, pluralize } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import {
  findSelectFilter,
  getActiveFilters,
  readStringList,
  readStringValue,
  TOOLBAR_FILTER_KEYS,
  withoutFilter,
} from "@/lib/search-filters";

const SEARCH_DEBOUNCE_MS = 350;
const ASCENDING_VALUE_PATTERN = /^asc/iu;
const DESCENDING_VALUE_PATTERN = /^desc/iu;

// The search atom is keyed by its parameters, so a new search starts from nothing.
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
    const storedSelection = filters[definition.key];
    const selected = new Set(
      Array.isArray(storedSelection)
        ? readStringList(storedSelection)
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
                  onValueChange(definition, [...next]);
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
          onCheckedChange={(checked) => {
            onValueChange(definition, checked === true);
          }}
        />
        <FieldLabel htmlFor={definition.key}>{definition.label}</FieldLabel>
      </Field>
    );
  }

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={definition.key}>{definition.label}</FieldLabel>
      <Select
        onValueChange={(value) => {
          onValueChange(definition, value);
        }}
        value={
          readStringValue(filters[definition.key]) ??
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
const SearchRouteComponent = () => {
  const sourcesResult = useAtomValue(sourcesQuery);
  const sources = Option.getOrElse(AsyncResult.value(sourcesResult), () => []);
  const sourceId = sources.find((source) => source.isEnabled)?.id ?? "";

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const filtersResult = useAtomValue(
    hasText(sourceId) ? sourceFilters({ sourceId }) : sourceFiltersIdle
  );
  const definitionsValue = AsyncResult.value(filtersResult);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [queryInput]);

  const definitions = useMemo(
    () => Option.getOrElse(definitionsValue, () => []),
    [definitionsValue]
  );
  const drawerDefinitions = definitions.filter(
    (definition) => !TOOLBAR_FILTER_KEYS.has(definition.key)
  );
  const sortDefinition = findSelectFilter(definitions, "sort");
  const orderDefinition = findSelectFilter(definitions, "order");
  const activeFilters = getActiveFilters(filters, definitions);
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
  const isSearchEnabled =
    hasText(sourceId) && !AsyncResult.isInitial(filtersResult);
  const searchAtom = isSearchEnabled
    ? searchPagesWithHistory({
        filters: effectiveFilters,
        pageSize: undefined,
        query,
        sourceId,
      })
    : searchIdle;
  const searchResult = useAtomValue(searchAtom);
  const pullNextPage = useAtomSet(searchAtom);
  const isOrderAscending =
    hasText(orderAscendingValue) &&
    effectiveFilters.order === orderAscendingValue;
  const pages = Option.getOrElse(
    Option.map(AsyncResult.value(searchResult), (value) => value.items),
    () => []
  );
  const results = pages.flatMap((page) => page.items);
  const total = pages.at(0)?.total ?? null;
  const hasNextPage = pages.at(-1)?.hasNextPage ?? false;
  const isSearching = AsyncResult.isWaiting(searchResult);
  const searchError = AsyncResult.cause(searchResult);
  const filtersUnavailable = Option.isSome(AsyncResult.cause(filtersResult));

  const applyFilterValue = (
    definition: SourceFilterDefinition,
    value: string | string[] | boolean | undefined
  ) => {
    setFilters((current) => {
      const patch = setFilterValue(definition, value);

      if (!patch) {
        return Object.fromEntries(
          Object.entries(current).filter(([key]) => key !== definition.key)
        );
      }

      return { ...current, ...patch };
    });
  };

  let resultsLabel = pluralize(results.length, "series", "series");

  if (query) {
    resultsLabel = `${pluralize(total ?? results.length, "result")} for “${query}”`;
  }

  const showSkeleton = Boolean(sourceId) && AsyncResult.isInitial(searchResult);
  const showError = Option.isSome(searchError);

  if (!showSkeleton && isSearching) {
    resultsLabel = "Searching…";
  }

  return (
    <AppShell>
      <PageHeader title="Search" />

      {sourcesResult._tag === "Failure" ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load sources</AlertTitle>
          <AlertDescription>
            {formatCause(sourcesResult.cause, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {filtersResult._tag === "Failure" ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load filters</AlertTitle>
          <AlertDescription>
            {formatCause(filtersResult.cause, "Reload the page to try again.")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          aria-label="Search titles"
          autoComplete="off"
          className="h-9 flex-1"
          onChange={(event) => {
            setQueryInput(event.target.value);
          }}
          placeholder="Search titles"
          value={queryInput}
        />
        {queryInput ? (
          <Button
            aria-label="Clear search"
            onClick={() => {
              setQueryInput("");
              setQuery("");
            }}
            size="icon-lg"
            type="button"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
        <Button
          className="h-9"
          onClick={() => {
            setIsFiltersOpen(true);
          }}
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
        {sortDefinition ? (
          <Select
            onValueChange={(value) => {
              applyFilterValue(sortDefinition, value);
            }}
            value={
              readStringValue(effectiveFilters[sortDefinition.key]) ??
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
              if (hasText(nextValue)) {
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
          {isSearching && !showSkeleton ? (
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
              onClick={() => {
                setFilters((current) => withoutFilter(current, active));
              }}
              type="button"
            >
              {active.label}
              <X className="text-muted-foreground size-3" />
            </button>
          ))}
          <Button
            className="h-6"
            onClick={() => {
              setFilters({});
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear all
          </Button>
        </div>
      ) : null}

      {Option.isSome(searchError) ? (
        <Alert variant="destructive">
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>
            {formatCause(searchError.value, "Try again in a moment.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {showSkeleton ? <ResultGridSkeleton /> : null}

      {showSkeleton ||
      showError ||
      AsyncResult.isInitial(sourcesResult) ||
      hasText(sourceId) ? null : (
        <EmptyState
          description="No source is connected yet."
          icon="search"
          title="No source available"
        />
      )}

      {hasText(sourceId) &&
      !(showSkeleton || showError || isSearching) &&
      results.length === 0 ? (
        <EmptyState
          action={
            activeFilters.length > 0 ? (
              <Button
                onClick={() => {
                  setFilters({});
                }}
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
              ? "Try a shorter title or a different spelling."
              : "Nothing matched the current filters."
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
          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                disabled={isSearching}
                onClick={() => {
                  pullNextPage();
                }}
                size="lg"
                type="button"
                variant="outline"
              >
                {isSearching ? "Loading..." : "Load more"}
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
            {filtersUnavailable ? (
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
              onClick={() => {
                setFilters({});
              }}
              type="button"
              variant="ghost"
            >
              Clear all
            </Button>
            <Button
              onClick={() => {
                setIsFiltersOpen(false);
              }}
              type="button"
            >
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
};

export const Route = createFileRoute("/search")({
  beforeLoad: requireAuth,
  component: SearchRouteComponent,
});
