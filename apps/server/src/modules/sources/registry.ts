import {
  createMangaDexSourceAdapter,
  type SourceAdapter,
} from "@mangy/source-sdk";

const adapters = [createMangaDexSourceAdapter()];

const adapterMap = new Map<string, SourceAdapter>(
  adapters.map((adapter) => [adapter.metadata.id, adapter])
);

export const sourceRegistry = {
  get(sourceId: string): SourceAdapter | null {
    return adapterMap.get(sourceId) ?? null;
  },
  list(): SourceAdapter[] {
    return adapters;
  },
};
