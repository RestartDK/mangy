import type { CheerioAPI } from "cheerio";

import type {
  SourceAdapter,
  SourceChapter,
  SourceFilterDefinition,
  SourceFilterOption,
  SourceListResponse,
  SourcePage,
  SourcePageList,
  SourceSearchInput,
  SourceSeries,
  SourceSeriesStatus,
} from "../types";
import {
  loadDocument,
  normalizeText,
  nullableText,
  uniqueStrings,
} from "./shared/html";
import { defaultUserAgent, fetchHtmlPage, resolveUrl } from "./shared/http";

const sourceBaseUrl = "https://www.mangaworld.mx/";
const archivePath = "archive";
const sourceLanguage = "it";
const remotePageSize = 16;
const defaultPageSize = 12;
const maxPageSize = 24;
const filterCacheTtlMs = 1000 * 60 * 60;

const detailPathPattern = /\/manga\/(?<seriesId>\d+)(?:\/(?<slug>[^/?#]+))?/i;
const chapterPathPattern =
  /\/manga\/(?<seriesId>\d+)\/(?<slug>[^/?#]+)\/read\/(?<chapterId>[a-z0-9]+)/i;
const chapterExternalIdPattern =
  /^(?<seriesId>\d+):(?<slug>[a-z0-9-]+):(?<chapterId>[a-z0-9]+)$/i;
const imagePathPattern = /https:\/\/cdn\.mangaworld\.mx\/chapters\/[^"'\s<]+/gi;
const titleScanSuffixPattern = /\s*Scan\s+ITA\s*-\s*MangaWorld$/i;
const titleSiteSuffixPattern = /\s*-\s*MangaWorld$/i;
const totalResultsPattern = /([\d.]+)\s+risultati/i;
const chapterDatePattern =
  /(?<day>\d{1,2})\s+(?<month>[a-z]+)(?:\s+(?<year>\d{4}))?/i;
const storyPrefixPattern = /^(trama|story):\s*/i;
const trailingColonPattern = /:$/;
const leadingColonPattern = /^:\s*/;
const chapterNumberPattern = /(?:capitolo|chapter)\s*([0-9]+(?:\.[0-9]+)?)/i;
const volumeNumberPattern = /volume\s+([0-9]+)/i;

const imageRequestHeaders = {
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "User-Agent": defaultUserAgent,
} as const;

const publicationDemographics = new Set([
  "josei",
  "seinen",
  "shoujo",
  "shounen",
]);

const monthNumbers = new Map<string, number>([
  ["gennaio", 0],
  ["febbraio", 1],
  ["marzo", 2],
  ["aprile", 3],
  ["maggio", 4],
  ["giugno", 5],
  ["luglio", 6],
  ["agosto", 7],
  ["settembre", 8],
  ["ottobre", 9],
  ["novembre", 10],
  ["dicembre", 11],
]);

interface MangaworldSeriesContext {
  canonicalUrl: string;
  seriesId: string;
  slug: string;
}

interface ArchivePageResult {
  items: SourceSeries[];
  total: number | null;
}

let cachedFilters:
  | {
      expiresAt: number;
      filters: SourceFilterDefinition[];
    }
  | undefined;

type CheerioElement = Parameters<CheerioAPI>[0];

const normalizePage = (page: number | undefined): number =>
  typeof page === "number" && page > 0 ? page : 1;

const normalizePageSize = (pageSize: number | undefined): number =>
  typeof pageSize === "number" && pageSize > 0
    ? Math.min(pageSize, maxPageSize)
    : defaultPageSize;

const cleanTitle = (
  value: string | null | undefined,
  fallback: string
): string => {
  const normalized = normalizeText(value) || fallback;

  return normalized
    .replace(titleScanSuffixPattern, "")
    .replace(titleSiteSuffixPattern, "")
    .trim();
};

const mapStatus = (value: string | null | undefined): SourceSeriesStatus => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "in corso":
    case "ongoing":
      return "ongoing";
    case "finito":
    case "completo":
    case "concluso":
    case "completed":
      return "completed";
    case "in pausa":
    case "hiatus":
      return "hiatus";
    case "droppato":
    case "cancellato":
    case "interrotto":
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
};

const inferContentRating = (tags: string[]): string | null => {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());

  if (normalizedTags.some((tag) => tag === "adulti" || tag === "hentai")) {
    return "adult";
  }

  if (normalizedTags.some((tag) => tag === "ecchi" || tag === "maturo")) {
    return "mature";
  }

  return null;
};

const inferPublicationDemographic = (tags: string[]): string | null => {
  const match = tags
    .map((tag) => tag.toLowerCase())
    .find((tag) => publicationDemographics.has(tag));

  return match ?? null;
};

const getSeriesContext = (url: string): MangaworldSeriesContext => {
  const match = detailPathPattern.exec(new URL(url).pathname);
  const seriesId = match?.groups?.seriesId;
  const slug = match?.groups?.slug;

  if (!(seriesId && slug)) {
    throw new Error(`Unable to parse MangaWorld series URL: ${url}`);
  }

  return {
    canonicalUrl: new URL(
      `/manga/${seriesId}/${slug}/`,
      sourceBaseUrl
    ).toString(),
    seriesId,
    slug,
  };
};

const parseChapterExternalId = (
  chapterId: string
): { chapterId: string; seriesId: string; slug: string } => {
  const match = chapterExternalIdPattern.exec(chapterId);
  const seriesId = match?.groups?.seriesId;
  const slug = match?.groups?.slug;
  const parsedChapterId = match?.groups?.chapterId;

  if (!(seriesId && slug && parsedChapterId)) {
    throw new Error(`Invalid MangaWorld chapter id: ${chapterId}`);
  }

  return {
    chapterId: parsedChapterId,
    seriesId,
    slug,
  };
};

const serializeChapterExternalId = (
  seriesId: string,
  slug: string,
  chapterId: string
): string => `${seriesId}:${slug}:${chapterId}`;

const createArchiveUrl = (searchParams: URLSearchParams): URL => {
  const url = new URL(archivePath, sourceBaseUrl);
  url.search = searchParams.toString();
  return url;
};

const createReaderUrl = (
  seriesId: string,
  slug: string,
  chapterId: string
): string =>
  new URL(
    `/manga/${seriesId}/${slug}/read/${chapterId}/1?style=list`,
    sourceBaseUrl
  ).toString();

const parseTotal = (text: string): number | null => {
  const match = totalResultsPattern.exec(text);
  const rawValue = match?.[1];

  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: string): Date | null => {
  const normalized = normalizeText(value).toLowerCase();
  const match = chapterDatePattern.exec(normalized);
  const day = match?.groups?.day ? Number(match.groups.day) : Number.NaN;
  const monthName = match?.groups?.month;
  const year = match?.groups?.year
    ? Number(match.groups.year)
    : new Date().getFullYear();
  const month = monthName ? monthNumbers.get(monthName) : undefined;

  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) {
    return null;
  }

  return new Date(Date.UTC(year, month, day));
};

const getOptions = (
  html: string,
  blockSelector: string
): SourceFilterOption[] => {
  const $ = loadDocument(html);

  return $(blockSelector)
    .find("option[data-name]")
    .toArray()
    .map((element) => ({
      label: normalizeText($(element).text()),
      value: normalizeText($(element).attr("data-name")),
    }))
    .filter((option) => option.label.length > 0 && option.value.length > 0);
};

const toSelectFilter = (
  key: string,
  label: string,
  options: SourceFilterOption[],
  defaultValue?: string
): SourceFilterDefinition => ({
  defaultValue,
  key,
  label,
  options: [{ label: "Any", value: "" }, ...options],
  type: "select",
});

const getCachedFilters = async (): Promise<SourceFilterDefinition[]> => {
  if (cachedFilters && cachedFilters.expiresAt > Date.now()) {
    return cachedFilters.filters;
  }

  const { html } = await fetchHtmlPage(createArchiveUrl(new URLSearchParams()));
  const filters: SourceFilterDefinition[] = [
    toSelectFilter("genre", "Genre", getOptions(html, ".genres")),
    toSelectFilter("type", "Type", getOptions(html, ".type")),
    toSelectFilter("status", "Status", getOptions(html, ".status")),
    toSelectFilter("year", "Year", getOptions(html, ".year")),
    {
      defaultValue: "a-z",
      key: "sort",
      label: "Sort by",
      options: getOptions(html, ".sort"),
      type: "select",
    },
  ];

  cachedFilters = {
    expiresAt: Date.now() + filterCacheTtlMs,
    filters,
  };

  return filters;
};

const getFilterValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const firstValue = value.find(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
    return firstValue ? normalizeText(firstValue) : null;
  }

  return null;
};

const applySearchFilters = (
  searchParams: URLSearchParams,
  filters: Record<string, unknown> | undefined
): void => {
  if (!filters) {
    return;
  }

  for (const key of ["genre", "type", "status", "year", "sort"] as const) {
    const value = getFilterValue(filters[key]);
    if (value) {
      searchParams.set(key, value);
    }
  }
};

const parseCardDescription = (value: string): string | null => {
  const normalized = normalizeText(value).replace(storyPrefixPattern, "");
  return normalized.length > 0 ? normalized : null;
};

const parseSeriesCard = (
  $: CheerioAPI,
  element: CheerioElement
): SourceSeries | null => {
  const card = $(element);
  const href =
    card.find("a.manga-title").first().attr("href") ??
    card.find("a.thumb").first().attr("href");

  if (!href) {
    return null;
  }

  const canonicalUrl = resolveUrl(sourceBaseUrl, href);
  const context = getSeriesContext(canonicalUrl);
  const tags = uniqueStrings(
    card
      .find(".genres a")
      .toArray()
      .map((link) => $(link).text())
  );
  const coverPath = card.find("a.thumb img").first().attr("src");

  return {
    artistNames: uniqueStrings(
      card
        .find(".artist a")
        .toArray()
        .map((link) => $(link).text())
    ),
    authorNames: uniqueStrings(
      card
        .find(".author a")
        .toArray()
        .map((link) => $(link).text())
    ),
    availableTranslatedLanguages: [sourceLanguage],
    canonicalUrl: context.canonicalUrl,
    contentRating: inferContentRating(tags),
    coverImageUrl: coverPath ? resolveUrl(sourceBaseUrl, coverPath) : null,
    description: parseCardDescription(card.find(".story").text()),
    externalId: context.seriesId,
    latestChapter: null,
    originalLanguage: null,
    publicationDemographic: inferPublicationDemographic(tags),
    status: mapStatus(
      card.find(".status a").first().text() || card.find(".status").text()
    ),
    tags,
    title: cleanTitle(
      card.find("a.manga-title").first().text() ||
        card.find("a.thumb img").first().attr("alt"),
      context.slug.replace(/-/g, " ")
    ),
  };
};

const parseArchivePage = async (
  searchParams: URLSearchParams,
  remotePage: number
): Promise<ArchivePageResult> => {
  const requestSearchParams = new URLSearchParams(searchParams);
  requestSearchParams.set("page", String(remotePage));

  const { html } = await fetchHtmlPage(createArchiveUrl(requestSearchParams));
  const $ = loadDocument(html);

  return {
    items: $(".comics-grid > .entry")
      .toArray()
      .map((element) => parseSeriesCard($, element))
      .filter((item): item is SourceSeries => item !== null),
    total: parseTotal($(".search-quantity").first().text()),
  };
};

const fetchArchiveResults = async (
  searchParams: URLSearchParams,
  page: number,
  pageSize: number
): Promise<SourceListResponse<SourceSeries>> => {
  const startIndex = (page - 1) * pageSize;
  const firstRemotePage = Math.floor(startIndex / remotePageSize) + 1;
  const lastRemoteIndex = startIndex + pageSize - 1;
  const lastRemotePage = Math.floor(lastRemoteIndex / remotePageSize) + 1;
  const remotePages = Array.from(
    { length: lastRemotePage - firstRemotePage + 1 },
    (_, index) => firstRemotePage + index
  );
  const results = await Promise.all(
    remotePages.map((remotePage) => parseArchivePage(searchParams, remotePage))
  );
  const total = results.find((result) => result.total !== null)?.total ?? null;
  const mergedItems = results.flatMap((result) => result.items);
  const offsetWithinMerged = startIndex % remotePageSize;
  const items = mergedItems.slice(
    offsetWithinMerged,
    offsetWithinMerged + pageSize
  );

  return {
    hasNextPage:
      total !== null
        ? startIndex + items.length < total
        : mergedItems.length > offsetWithinMerged + items.length,
    items,
    page,
    pageSize,
    total,
  };
};

const fetchSeriesDocument = async (
  seriesId: string
): Promise<{ context: MangaworldSeriesContext; html: string }> => {
  const { html, response } = await fetchHtmlPage(
    new URL(`/manga/${seriesId}`, sourceBaseUrl)
  );

  return {
    context: getSeriesContext(response.url),
    html,
  };
};

const extractDetailValues = ($: CheerioAPI): Map<string, string[]> => {
  const detailMap = new Map<string, string[]>();

  for (const element of $(".meta-data > div").toArray()) {
    const container = $(element);
    const label = normalizeText(
      container.find("span.font-weight-bold").first().text()
    ).replace(trailingColonPattern, "");

    if (!label) {
      continue;
    }

    const linkValues = uniqueStrings(
      container
        .find("a")
        .toArray()
        .map((link) => $(link).text())
    );

    if (linkValues.length > 0) {
      detailMap.set(label, linkValues);
      continue;
    }

    const rawText = normalizeText(container.text());
    let textWithoutLabel = rawText.startsWith(label)
      ? rawText.slice(label.length)
      : rawText;

    textWithoutLabel = textWithoutLabel.replace(leadingColonPattern, "");

    const value = nullableText(textWithoutLabel);
    if (value) {
      detailMap.set(label, [value]);
    }
  }

  return detailMap;
};

const parseChapterToken = (href: string): string | null => {
  const match = chapterPathPattern.exec(new URL(href).pathname);
  return match?.groups?.chapterId ?? null;
};

const parseChapters = (
  html: string,
  context: MangaworldSeriesContext
): SourceChapter[] => {
  const $ = loadDocument(html);
  const chapters: SourceChapter[] = [];
  const seenChapterIds = new Set<string>();

  const addChapter = (
    href: string,
    volumeNumber: string | null,
    element: CheerioElement
  ) => {
    if (!href) {
      return;
    }

    const chapterUrl = resolveUrl(sourceBaseUrl, href);
    const chapterToken = parseChapterToken(chapterUrl);

    if (!chapterToken || seenChapterIds.has(chapterToken)) {
      return;
    }

    seenChapterIds.add(chapterToken);

    const container = $(element);
    const chapterLabel = normalizeText(
      container.find("span.d-inline-block").first().text() || container.text()
    );
    const chapterNumberMatch = chapterNumberPattern.exec(chapterLabel);
    const chapterNumber = chapterNumberMatch?.[1] ?? null;

    chapters.push({
      chapterNumber,
      externalId: serializeChapterExternalId(
        context.seriesId,
        context.slug,
        chapterToken
      ),
      externalUrl: chapterUrl,
      isUnavailable: false,
      pageCount: null,
      publishedAt: parseDate(container.find(".chap-date").first().text()),
      sourceOrder: chapterNumber ?? `special-${chapters.length + 1}`,
      title: chapterNumber ? null : nullableText(chapterLabel),
      translatedLanguage: sourceLanguage,
      volumeNumber,
    });
  };

  const volumeElements = $(".volume-element").toArray();
  if (volumeElements.length > 0) {
    for (const volumeElement of volumeElements) {
      const volumeLabel = normalizeText(
        $(volumeElement).find(".volume-name").first().text()
      );
      const volumeMatch = volumeNumberPattern.exec(volumeLabel);
      const volumeNumber = volumeMatch?.[1] ?? null;

      for (const chapterLink of $(volumeElement)
        .find(".chapter a[href]")
        .toArray()) {
        addChapter(
          $(chapterLink).attr("href") ?? "",
          volumeNumber,
          chapterLink
        );
      }
    }

    return chapters;
  }

  for (const chapterLink of $(".chapters-wrapper a.chap[href]").toArray()) {
    addChapter($(chapterLink).attr("href") ?? "", null, chapterLink);
  }

  return chapters;
};

const parseSeriesDetails = (
  html: string,
  context: MangaworldSeriesContext
): SourceSeries => {
  const $ = loadDocument(html);
  const detailValues = extractDetailValues($);
  const tags = detailValues.get("Generi") ?? [];
  const chapters = parseChapters(html, context);
  const coverPath =
    $(".comic-info .thumb img").first().attr("src") ??
    $("meta[property='og:image']").attr("content");
  const title = cleanTitle(
    $("h1.name").first().text() ||
      $("meta[property='og:title']").attr("content"),
    context.slug.replace(/-/g, " ")
  );

  return {
    artistNames: detailValues.get("Artista") ?? [],
    authorNames: detailValues.get("Autore") ?? [],
    availableTranslatedLanguages: [sourceLanguage],
    canonicalUrl: context.canonicalUrl,
    contentRating: inferContentRating(tags),
    coverImageUrl: coverPath ? resolveUrl(sourceBaseUrl, coverPath) : null,
    description:
      nullableText($("#noidungm").first().text()) ??
      nullableText($("meta[name='description']").attr("content")),
    externalId: context.seriesId,
    latestChapter: chapters[0]?.chapterNumber ?? null,
    originalLanguage: null,
    publicationDemographic: inferPublicationDemographic(tags),
    status: mapStatus(detailValues.get("Stato")?.[0]),
    tags,
    title,
  };
};

const extractPageImageUrls = (html: string): string[] => {
  const $ = loadDocument(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (value: string | null | undefined) => {
    const normalized = nullableText(value);
    if (!normalized) {
      return;
    }

    const absoluteUrl = resolveUrl(sourceBaseUrl, normalized);
    if (!absoluteUrl.includes("/chapters/") || seen.has(absoluteUrl)) {
      return;
    }

    seen.add(absoluteUrl);
    urls.push(absoluteUrl);
  };

  for (const element of $(
    "img[src*='/chapters/'], img[data-src*='/chapters/'], img[srcset*='/chapters/']"
  ).toArray()) {
    const container = $(element);
    addUrl(container.attr("data-src"));
    addUrl(container.attr("src"));

    const srcset = container.attr("srcset");
    if (srcset) {
      for (const candidate of srcset.split(",")) {
        addUrl(normalizeText(candidate).split(" ")[0]);
      }
    }
  }

  if (urls.length > 0) {
    return urls;
  }

  for (const match of html.matchAll(imagePathPattern)) {
    addUrl(match[0]);
  }

  return urls;
};

export const createMangaworldSourceAdapter = (): SourceAdapter => ({
  metadata: {
    capabilities: {
      supportsChapterFeed: true,
      supportsFilters: true,
      supportsLatest: true,
      supportsPageFetch: true,
      supportsPopular: true,
      supportsSearch: true,
      supportsSeriesDetails: true,
      supportsTrending: false,
    },
    description:
      "Italian MangaWorld HTML adapter for discovery, search, series metadata, chapter feeds, and page extraction.",
    iconUrl: new URL(
      "/public/assets/seo/favicon-96x96.png?v=3",
      sourceBaseUrl
    ).toString(),
    id: "mangaWorld",
    languageCode: sourceLanguage,
    name: "MangaWorld",
    supportedLanguages: [sourceLanguage],
    websiteUrl: sourceBaseUrl,
  },
  getFilters() {
    return getCachedFilters();
  },
  getLatest(page, pageSize) {
    const resolvedPage = normalizePage(page);
    const resolvedPageSize = normalizePageSize(pageSize);
    const searchParams = new URLSearchParams();
    searchParams.set("sort", "newest");
    return fetchArchiveResults(searchParams, resolvedPage, resolvedPageSize);
  },
  getPopular(page, pageSize) {
    const resolvedPage = normalizePage(page);
    const resolvedPageSize = normalizePageSize(pageSize);
    const searchParams = new URLSearchParams();
    searchParams.set("sort", "most_read");
    return fetchArchiveResults(searchParams, resolvedPage, resolvedPageSize);
  },
  async getSeries(seriesId) {
    const { context, html } = await fetchSeriesDocument(seriesId);
    return parseSeriesDetails(html, context);
  },
  async getChapters(seriesId) {
    const { context, html } = await fetchSeriesDocument(seriesId);
    return parseChapters(html, context);
  },
  async getPages(chapterId) {
    const {
      chapterId: parsedChapterId,
      seriesId,
      slug,
    } = parseChapterExternalId(chapterId);
    const readerUrl = createReaderUrl(seriesId, slug, parsedChapterId);
    const { html } = await fetchHtmlPage(readerUrl, {
      referer: new URL(`/manga/${seriesId}/${slug}/`, sourceBaseUrl).toString(),
    });
    const pages: SourcePage[] = extractPageImageUrls(html).map(
      (imageUrl, index) => ({
        headers: { ...imageRequestHeaders },
        imageUrl,
        index,
        referer: readerUrl,
      })
    );

    const pageList: SourcePageList = { pages };
    return pageList;
  },
  searchSeries(input: SourceSearchInput) {
    const resolvedPage = normalizePage(input.page);
    const resolvedPageSize = normalizePageSize(input.pageSize);
    const searchParams = new URLSearchParams();

    const query = input.query?.trim();
    if (query) {
      searchParams.set("keyword", query);
    }

    applySearchFilters(searchParams, input.filters);
    if (!searchParams.has("sort")) {
      searchParams.set("sort", "a-z");
    }

    return fetchArchiveResults(searchParams, resolvedPage, resolvedPageSize);
  },
});
