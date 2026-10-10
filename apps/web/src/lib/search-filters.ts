import type { SourceFilterDefinition } from "@/hooks/use-source-filters";

export const TOOLBAR_FILTER_KEYS = new Set(["sort", "order"]);

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  kind: SourceFilterDefinition["type"];
}

export const findSelectFilter = (
  definitions: SourceFilterDefinition[],
  key: string
): Extract<SourceFilterDefinition, { type: "select" }> | undefined => {
  const definition = definitions.find((item) => item.key === key);

  return definition?.type === "select" ? definition : undefined;
};

const findOptionLabel = (
  definition: SourceFilterDefinition,
  value: string
): string => {
  if (definition.type === "toggle") {
    return definition.label;
  }

  return (
    definition.options.find((option) => option.value === value)?.label ?? value
  );
};

const toActiveFilters = (
  definition: SourceFilterDefinition,
  value: unknown
): ActiveFilter[] => {
  const kind = definition.type;

  if (definition.type === "multiSelect") {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => ({
        key: definition.key,
        kind,
        label: `${definition.label}: ${findOptionLabel(definition, item)}`,
        value: item,
      }));
  }

  if (definition.type === "toggle") {
    return value === true
      ? [{ key: definition.key, kind, label: definition.label, value: "true" }]
      : [];
  }

  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  return [
    {
      key: definition.key,
      kind,
      label: `${definition.label}: ${findOptionLabel(definition, value)}`,
      value,
    },
  ];
};

export const getActiveFilters = (
  filters: Record<string, unknown>,
  definitions: SourceFilterDefinition[]
): ActiveFilter[] =>
  definitions
    .filter((definition) => !TOOLBAR_FILTER_KEYS.has(definition.key))
    .flatMap((definition) =>
      toActiveFilters(definition, filters[definition.key])
    );

export const withoutFilter = (
  filters: Record<string, unknown>,
  active: ActiveFilter
): Record<string, unknown> => {
  const next = { ...filters };

  if (active.kind === "multiSelect" && Array.isArray(next[active.key])) {
    const remaining = (next[active.key] as string[]).filter(
      (item) => item !== active.value
    );

    if (remaining.length > 0) {
      next[active.key] = remaining;
      return next;
    }
  }

  delete next[active.key];

  return next;
};
