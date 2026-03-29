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

export interface SourceFilterOption {
  label: string;
  value: string;
}

export interface SourceSelectFilter {
  type: "select";
  key: string;
  label: string;
  options: SourceFilterOption[];
  defaultValue?: string;
}

export interface SourceMultiSelectFilter {
  type: "multiSelect";
  key: string;
  label: string;
  options: SourceFilterOption[];
  defaultValue?: string[];
}

export interface SourceToggleFilter {
  type: "toggle";
  key: string;
  label: string;
  defaultValue?: boolean;
}

export type SourceFilterDefinition =
  | SourceSelectFilter
  | SourceMultiSelectFilter
  | SourceToggleFilter;

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

export type SourceSeriesStatus =
  | "ongoing"
  | "completed"
  | "hiatus"
  | "cancelled"
  | "unknown";

export interface SourceSeries {
  externalId: string;
  title: string;
  description: string | null;
  canonicalUrl: string | null;
  coverImageUrl: string | null;
  status: SourceSeriesStatus;
  originalLanguage: string | null;
  latestChapter: string | null;
  contentRating: string | null;
  publicationDemographic: string | null;
  authorNames: string[];
  artistNames: string[];
  tags: string[];
  availableTranslatedLanguages: string[];
}

export interface SourceChapter {
  externalId: string;
  title: string | null;
  chapterNumber: string | null;
  volumeNumber: string | null;
  translatedLanguage: string | null;
  externalUrl: string | null;
  sourceOrder: string | null;
  pageCount: number | null;
  publishedAt: Date | null;
  isUnavailable: boolean;
}

export interface SourcePage {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>;
  referer?: string;
}

export interface SourcePageList {
  pages: SourcePage[];
}

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

export interface SourceAdapter {
  metadata: SourceMetadata;
  getFilters(): Promise<SourceFilterDefinition[]>;
  getPopular(
    page?: number,
    pageSize?: number
  ): Promise<SourceListResponse<SourceSeries>>;
  getLatest(
    page?: number,
    pageSize?: number
  ): Promise<SourceListResponse<SourceSeries>>;
  getTrending?(
    page?: number,
    pageSize?: number
  ): Promise<SourceListResponse<SourceSeries>>;
  searchSeries(
    input: SourceSearchInput
  ): Promise<SourceListResponse<SourceSeries>>;
  getSeries(seriesId: string): Promise<SourceSeries>;
  getChapters(seriesId: string): Promise<SourceChapter[]>;
  getPages(chapterId: string): Promise<SourcePageList>;
}
