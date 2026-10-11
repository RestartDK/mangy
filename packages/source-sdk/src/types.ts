import type { Effect } from "effect";

import type { SourceAdapterError } from "./errors";
import type {
  sourceChapterSchema,
  sourceFilterOptionSchema,
  sourceFilterSchema,
  sourcePageListSchema,
  sourcePageSchema,
  sourceSeriesSchema,
  sourceSeriesStatusSchema,
} from "./schemas";

export interface SourceCapabilities {
  supportsPopular: boolean;
  supportsLatest: boolean;
  supportsTrending: boolean;
  supportsSearch: boolean;
  supportsFilters: boolean;
  supportsSeriesDetails: boolean;
  supportsChapterFeed: boolean;
  supportsPageFetch: boolean;
}

export type SourceFilterOption = typeof sourceFilterOptionSchema.Type;

export type SourceFilterDefinition = typeof sourceFilterSchema.Type;

export type SourceSelectFilter = Extract<
  SourceFilterDefinition,
  { type: "select" }
>;

export type SourceMultiSelectFilter = Extract<
  SourceFilterDefinition,
  { type: "multiSelect" }
>;

export type SourceToggleFilter = Extract<
  SourceFilterDefinition,
  { type: "toggle" }
>;

export interface SourceMetadata {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  iconUrl?: string;
  languageCode: string;
  supportedLanguages: string[];
  capabilities: SourceCapabilities;
}

export type SourceSeriesStatus = typeof sourceSeriesStatusSchema.Type;

export type SourceSeries = typeof sourceSeriesSchema.Type;

export type SourceChapter = typeof sourceChapterSchema.Type;

export type SourcePage = typeof sourcePageSchema.Type;

export type SourcePageList = typeof sourcePageListSchema.Type;

export interface SourceListResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number | null;
  hasNextPage: boolean;
}

export interface SourceSearchInput {
  query?: string;
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export type SourceAdapterEffect<TResult> = Effect.Effect<
  TResult,
  SourceAdapterError
>;

export interface SourceAdapter {
  metadata: SourceMetadata;
  getFilters: SourceAdapterEffect<SourceFilterDefinition[]>;
  getPopular: (
    page?: number,
    pageSize?: number
  ) => SourceAdapterEffect<SourceListResponse<SourceSeries>>;
  getLatest: (
    page?: number,
    pageSize?: number
  ) => SourceAdapterEffect<SourceListResponse<SourceSeries>>;
  getTrending?: (
    page?: number,
    pageSize?: number
  ) => SourceAdapterEffect<SourceListResponse<SourceSeries>>;
  searchSeries: (
    input: SourceSearchInput
  ) => SourceAdapterEffect<SourceListResponse<SourceSeries>>;
  getSeries: (seriesId: string) => SourceAdapterEffect<SourceSeries>;
  getChapters: (seriesId: string) => SourceAdapterEffect<SourceChapter[]>;
  getPages: (chapterId: string) => SourceAdapterEffect<SourcePageList>;
}
