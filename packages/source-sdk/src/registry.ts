import { createMangaDexSourceAdapter } from "./adapters/mangaDex";
import type { SourceAdapter } from "./types";

export interface SourceRegistry {
  get(sourceId: string): SourceAdapter | null;
  list(): SourceAdapter[];
  register(adapter: SourceAdapter): void;
  remove(sourceId: string): void;
  replaceAll(adapters: SourceAdapter[]): void;
  reset(): void;
}

const createDefaultAdapters = (): SourceAdapter[] => [
  createMangaDexSourceAdapter(),
];

let adapters = createDefaultAdapters();

const createAdapterMap = (items: SourceAdapter[]) =>
  new Map<string, SourceAdapter>(
    items.map((adapter) => [adapter.metadata.id, adapter])
  );

let adapterMap = createAdapterMap(adapters);

const syncRegistryState = (items: SourceAdapter[]) => {
  adapters = [...items];
  adapterMap = createAdapterMap(adapters);
};

export const sourceRegistry: SourceRegistry = {
  get(sourceId: string): SourceAdapter | null {
    return adapterMap.get(sourceId) ?? null;
  },
  list(): SourceAdapter[] {
    return [...adapters];
  },
  register(adapter: SourceAdapter): void {
    syncRegistryState([
      ...adapters.filter((item) => item.metadata.id !== adapter.metadata.id),
      adapter,
    ]);
  },
  remove(sourceId: string): void {
    syncRegistryState(
      adapters.filter((adapter) => adapter.metadata.id !== sourceId)
    );
  },
  replaceAll(items: SourceAdapter[]): void {
    syncRegistryState(items);
  },
  reset(): void {
    syncRegistryState(createDefaultAdapters());
  },
};
