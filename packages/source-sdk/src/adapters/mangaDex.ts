import type {
  SourceAdapter,
  SourceChapter,
  SourceFilterDefinition,
  SourceListResponse,
  SourcePageList,
  SourceSeries,
  SourceSeriesStatus,
} from "../types";

const apiBaseUrl = "https://api.mangadex.org";
const coverBaseUrl = "https://uploads.mangadex.org/covers";
const defaultLanguage = "en";

const defaultContentRatings = ["safe", "suggestive"];

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}

interface MangaDexTag {
  id: string;
  attributes?: {
    group?: string;
    name?: Record<string, string>;
  };
}

interface MangaDexMangaAttributes {
  title?: Record<string, string>;
  description?: Record<string, string>;
  originalLanguage?: string;
  status?: string;
  lastChapter?: string;
  contentRating?: string;
  publicationDemographic?: string;
  availableTranslatedLanguages?: string[];
  tags?: MangaDexTag[];
}

interface MangaDexManga {
  id: string;
  attributes: MangaDexMangaAttributes;
  relationships?: MangaDexRelationship[];
}

interface MangaDexChapter {
  id: string;
  attributes: {
    title?: string | null;
    chapter?: string | null;
    volume?: string | null;
    translatedLanguage?: string | null;
    externalUrl?: string | null;
    publishAt?: string | null;
    pages?: number | null;
    isUnavailable?: boolean;
  };
}

interface MangaDexCollectionResponse<TItem> {
  data: TItem[];
  limit: number;
  offset: number;
  total: number;
}

interface MangaDexAtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
  };
}

let cachedTagFilters:
  | {
      expiresAt: number;
      filters: SourceFilterDefinition[];
    }
  | undefined;

const pickLocalizedString = (
  values: Record<string, string> | undefined,
  fallback = "Untitled"
): string => {
  if (!values) {
    return fallback;
  }

  for (const locale of [defaultLanguage, "en-us", "ja-ro", "ja"]) {
    const match = values[locale];
    if (match) {
      return match;
    }
  }

  const firstValue = Object.values(values)[0];
  return firstValue ?? fallback;
};

const buildCoverImageUrl = (
  mangaId: string,
  relationships: MangaDexRelationship[] | undefined
): string | null => {
  const coverRelationship = relationships?.find(
    (relationship) => relationship.type === "cover_art"
  );
  const fileName = coverRelationship?.attributes?.fileName;

  if (typeof fileName !== "string") {
    return null;
  }

  return `${coverBaseUrl}/${mangaId}/${fileName}.256.jpg`;
};

const mapStatus = (value: string | undefined): SourceSeriesStatus => {
  switch (value) {
    case "ongoing":
    case "completed":
    case "hiatus":
    case "cancelled":
      return value;
    default:
      return "unknown";
  }
};

const mapSeries = (manga: MangaDexManga): SourceSeries => {
  const authorNames =
    manga.relationships
      ?.filter((relationship) => relationship.type === "author")
      .map((relationship) => relationship.attributes?.name)
      .filter((name): name is string => typeof name === "string") ?? [];

  const artistNames =
    manga.relationships
      ?.filter((relationship) => relationship.type === "artist")
      .map((relationship) => relationship.attributes?.name)
      .filter((name): name is string => typeof name === "string") ?? [];

  return {
    externalId: manga.id,
    title: pickLocalizedString(manga.attributes.title),
    description: pickLocalizedString(manga.attributes.description, ""),
    canonicalUrl: `https://mangadex.org/title/${manga.id}`,
    coverImageUrl: buildCoverImageUrl(manga.id, manga.relationships),
    status: mapStatus(manga.attributes.status),
    originalLanguage: manga.attributes.originalLanguage ?? null,
    latestChapter: manga.attributes.lastChapter ?? null,
    contentRating: manga.attributes.contentRating ?? null,
    publicationDemographic: manga.attributes.publicationDemographic ?? null,
    authorNames,
    artistNames,
    tags:
      manga.attributes.tags
        ?.map((tag) => pickLocalizedString(tag.attributes?.name, ""))
        .filter(Boolean) ?? [],
    availableTranslatedLanguages:
      manga.attributes.availableTranslatedLanguages ?? [],
  };
};

const mapChapter = (chapter: MangaDexChapter): SourceChapter => ({
  externalId: chapter.id,
  title: chapter.attributes.title ?? null,
  chapterNumber: chapter.attributes.chapter ?? null,
  volumeNumber: chapter.attributes.volume ?? null,
  translatedLanguage: chapter.attributes.translatedLanguage ?? null,
  externalUrl: chapter.attributes.externalUrl ?? null,
  sourceOrder: chapter.attributes.chapter ?? null,
  pageCount: chapter.attributes.pages ?? null,
  publishedAt: chapter.attributes.publishAt
    ? new Date(chapter.attributes.publishAt)
    : null,
  isUnavailable: chapter.attributes.isUnavailable ?? false,
});

const fetchJson = async <TResponse>(
  path: string,
  searchParams?: URLSearchParams
): Promise<TResponse> => {
  const url = new URL(path, apiBaseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "mangy/0.1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`MangaDex request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
};

const appendValues = (
  searchParams: URLSearchParams,
  key: string,
  values: string[]
): void => {
  for (const value of values) {
    searchParams.append(key, value);
  }
};

const createBaseMangaParams = (
  page: number,
  pageSize: number
): URLSearchParams => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(pageSize));
  searchParams.set("offset", String((page - 1) * pageSize));
  searchParams.append("includes[]", "cover_art");
  searchParams.append("includes[]", "author");
  searchParams.append("includes[]", "artist");
  appendValues(searchParams, "availableTranslatedLanguage[]", [
    defaultLanguage,
  ]);
  appendValues(searchParams, "contentRating[]", defaultContentRatings);
  return searchParams;
};

const mapListResponse = (
  response: MangaDexCollectionResponse<MangaDexManga>,
  page: number,
  pageSize: number
): SourceListResponse<SourceSeries> => ({
  items: response.data.map(mapSeries),
  page,
  pageSize,
  total: response.total,
  hasNextPage: response.offset + response.limit < response.total,
});

const normalizePage = (page: number | undefined): number =>
  typeof page === "number" && page > 0 ? page : 1;

const normalizePageSize = (pageSize: number | undefined): number =>
  typeof pageSize === "number" && pageSize > 0 ? Math.min(pageSize, 24) : 12;

const getCachedTagFilters = async (): Promise<SourceFilterDefinition[]> => {
  if (cachedTagFilters && cachedTagFilters.expiresAt > Date.now()) {
    return cachedTagFilters.filters;
  }

  const response =
    await fetchJson<MangaDexCollectionResponse<MangaDexTag>>("/manga/tag");
  const tagOptions = response.data
    .map((tag) => ({
      label: pickLocalizedString(tag.attributes?.name, "Unknown"),
      value: tag.id,
      group: tag.attributes?.group ?? "other",
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const filters: SourceFilterDefinition[] = [
    {
      type: "multiSelect",
      key: "contentRatings",
      label: "Content rating",
      defaultValue: defaultContentRatings,
      options: [
        { label: "Safe", value: "safe" },
        { label: "Suggestive", value: "suggestive" },
        { label: "Erotica", value: "erotica" },
        { label: "Pornographic", value: "pornographic" },
      ],
    },
    {
      type: "select",
      key: "status",
      label: "Status",
      options: [
        { label: "Any", value: "" },
        { label: "Ongoing", value: "ongoing" },
        { label: "Completed", value: "completed" },
        { label: "Hiatus", value: "hiatus" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      type: "select",
      key: "publicationDemographic",
      label: "Demographic",
      options: [
        { label: "Any", value: "" },
        { label: "Shonen", value: "shounen" },
        { label: "Shojo", value: "shoujo" },
        { label: "Seinen", value: "seinen" },
        { label: "Josei", value: "josei" },
      ],
    },
    {
      type: "select",
      key: "originalLanguage",
      label: "Original language",
      options: [
        { label: "Any", value: "" },
        { label: "Japanese", value: "ja" },
        { label: "Korean", value: "ko" },
        { label: "Chinese", value: "zh" },
        { label: "English", value: "en" },
      ],
    },
    {
      type: "multiSelect",
      key: "includedTagIds",
      label: "Genres and themes",
      options: tagOptions.map(({ group, ...option }) => ({
        label: group === "genre" ? option.label : `${option.label} (${group})`,
        value: option.value,
      })),
    },
  ];

  cachedTagFilters = {
    filters,
    expiresAt: Date.now() + 1000 * 60 * 60,
  };

  return filters;
};

const applySearchFilters = (
  searchParams: URLSearchParams,
  filters: Record<string, unknown> | undefined
): void => {
  if (!filters) {
    return;
  }

  const contentRatings = filters.contentRatings;
  if (Array.isArray(contentRatings) && contentRatings.length > 0) {
    appendValues(
      searchParams,
      "contentRating[]",
      contentRatings.filter(
        (value): value is string => typeof value === "string"
      )
    );
  }

  const includedTagIds = filters.includedTagIds;
  if (Array.isArray(includedTagIds) && includedTagIds.length > 0) {
    appendValues(
      searchParams,
      "includedTags[]",
      includedTagIds.filter(
        (value): value is string => typeof value === "string"
      )
    );
  }

  for (const [key, apiKey] of [
    ["status", "status[]"],
    ["publicationDemographic", "publicationDemographic[]"],
    ["originalLanguage", "originalLanguage[]"],
  ] as const) {
    const value = filters[key];
    if (typeof value === "string" && value.length > 0) {
      searchParams.append(apiKey, value);
    }
  }
};

const fetchMangaList = async (
  searchParams: URLSearchParams,
  page: number,
  pageSize: number
): Promise<SourceListResponse<SourceSeries>> => {
  const response = await fetchJson<MangaDexCollectionResponse<MangaDexManga>>(
    "/manga",
    searchParams
  );

  return mapListResponse(response, page, pageSize);
};

export const createMangaDexSourceAdapter = (): SourceAdapter => ({
  metadata: {
    id: "mangaDex",
    name: "MangaDex",
    description:
      "Public MangaDex catalog integration for discovery, search, series metadata, and chapter feeds.",
    websiteUrl: "https://mangadex.org",
    iconUrl: "https://mangadex.org/favicon.ico",
    languageCode: "multi",
    supportedLanguages: [defaultLanguage],
    capabilities: {
      supportsPopular: true,
      supportsLatest: true,
      supportsTrending: true,
      supportsSearch: true,
      supportsFilters: true,
      supportsSeriesDetails: true,
      supportsChapterFeed: true,
      supportsPageFetch: true,
    },
  },
  async getFilters() {
    return getCachedTagFilters();
  },
  async getPopular(page, pageSize) {
    const resolvedPage = normalizePage(page);
    const resolvedPageSize = normalizePageSize(pageSize);
    const searchParams = createBaseMangaParams(resolvedPage, resolvedPageSize);
    searchParams.append("order[followedCount]", "desc");
    return fetchMangaList(searchParams, resolvedPage, resolvedPageSize);
  },
  async getLatest(page, pageSize) {
    const resolvedPage = normalizePage(page);
    const resolvedPageSize = normalizePageSize(pageSize);
    const searchParams = createBaseMangaParams(resolvedPage, resolvedPageSize);
    searchParams.append("order[latestUploadedChapter]", "desc");
    return fetchMangaList(searchParams, resolvedPage, resolvedPageSize);
  },
  async getTrending(page, pageSize) {
    const resolvedPage = normalizePage(page);
    const resolvedPageSize = normalizePageSize(pageSize);
    const searchParams = createBaseMangaParams(resolvedPage, resolvedPageSize);
    searchParams.append("order[followedCount]", "desc");
    searchParams.append("order[latestUploadedChapter]", "desc");
    return fetchMangaList(searchParams, resolvedPage, resolvedPageSize);
  },
  async searchSeries(input) {
    const resolvedPage = normalizePage(input.page);
    const resolvedPageSize = normalizePageSize(input.pageSize);
    const searchParams = createBaseMangaParams(resolvedPage, resolvedPageSize);
    if (input.query) {
      searchParams.set("title", input.query);
    }
    applySearchFilters(searchParams, input.filters);
    return fetchMangaList(searchParams, resolvedPage, resolvedPageSize);
  },
  async getSeries(seriesId) {
    const searchParams = new URLSearchParams();
    searchParams.append("includes[]", "cover_art");
    searchParams.append("includes[]", "author");
    searchParams.append("includes[]", "artist");
    const response = await fetchJson<{ data: MangaDexManga }>(
      `/manga/${seriesId}`,
      searchParams
    );
    return mapSeries(response.data);
  },
  async getChapters(seriesId) {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", "100");
    searchParams.append("translatedLanguage[]", defaultLanguage);
    searchParams.append("order[chapter]", "desc");
    const response = await fetchJson<
      MangaDexCollectionResponse<MangaDexChapter>
    >(`/manga/${seriesId}/feed`, searchParams);
    return response.data.map(mapChapter);
  },
  async getPages(chapterId) {
    const response = await fetchJson<MangaDexAtHomeResponse>(
      `/at-home/server/${chapterId}`
    );

    const pages = response.chapter.data.map((fileName, index) => ({
      index,
      imageUrl: `${response.baseUrl}/data/${response.chapter.hash}/${fileName}`,
    }));

    const pageList: SourcePageList = { pages };
    return pageList;
  },
});
