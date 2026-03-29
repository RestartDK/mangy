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
import { BrowserUnavailableError, withBrowserPage } from "./shared/browser";
import {
  loadDocument,
  normalizeText,
  nullableText,
  uniqueStrings,
} from "./shared/html";
import { fetchHtmlPage, resolveUrl } from "./shared/http";

const sourceBaseUrl = "https://weebcentral.com/";
const searchPageUrl = new URL("search", sourceBaseUrl);
const sourceLanguage = "en";
const defaultPageSize = 12;
const maxPageSize = 24;
const filterCacheTtlMs = 1000 * 60 * 60;
const pageImageSelector = 'img[alt^="Page"]';
const searchDisplayMode = "Full Display";
const browserReadingStyle = "long_strip";
const pageImagePattern = /https?:\/\/temp\.compsci88\.com\/manga\/[^"'\s<>]+/gi;
const trailingCommaPattern = /,$/;
const titleSuffixPattern = /\s*\|\s*Weeb Central$/i;
const chapterNumberPattern = /chapter\s+([0-9]+(?:\.[0-9]+)?)/i;
const titlePrefixPattern = /^chapter\s+[0-9]+(?:\.[0-9]+)?[:\s-]*/i;
const chapterPathPattern = /\/chapters\/(?<chapterId>[A-Z0-9]+)/i;
const seriesPathPattern =
  /\/series\/(?<seriesKey>[A-Z0-9]+)(?:\/(?<slug>[^/?#]+))?/i;

const imageRequestHeaders = {
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
} as const;

const publicationDemographics = new Set([
  "josei",
  "seinen",
  "shoujo",
  "shounen",
]);

interface WeebCentralDependencies {
  renderChapterPageImages: (chapterId: string) => Promise<string[]>;
}

interface WeebCentralSeriesContext {
  canonicalUrl: string;
  externalId: string;
  seriesKey: string;
  slug: string;
}

let cachedFilters:
  | {
      expiresAt: number;
      filters: SourceFilterDefinition[];
    }
  | undefined;

const normalizePage = (page: number | undefined): number =>
  typeof page === "number" && page > 0 ? page : 1;

const normalizePageSize = (pageSize: number | undefined): number =>
  typeof pageSize === "number" && pageSize > 0
    ? Math.min(pageSize, maxPageSize)
    : defaultPageSize;

const serializeSeriesId = (seriesKey: string, slug: string): string =>
  `${seriesKey}:${slug}`;

const parseSeriesId = (
  seriesId: string
): { seriesKey: string; slug: string } => {
  const [seriesKey, ...slugParts] = seriesId.split(":");
  const slug = slugParts.join(":");

  if (!(seriesKey && slug)) {
    throw new Error(`Invalid WeebCentral series id: ${seriesId}`);
  }

  return {
    seriesKey,
    slug,
  };
};

const parseSeriesContext = (url: string): WeebCentralSeriesContext => {
  const match = seriesPathPattern.exec(new URL(url).pathname);
  const seriesKey = match?.groups?.seriesKey;
  const slug = match?.groups?.slug;

  if (!(seriesKey && slug)) {
    throw new Error(`Unable to parse WeebCentral series url: ${url}`);
  }

  return {
    canonicalUrl: new URL(
      `/series/${seriesKey}/${slug}`,
      sourceBaseUrl
    ).toString(),
    externalId: serializeSeriesId(seriesKey, slug),
    seriesKey,
    slug,
  };
};

const createSeriesUrl = (seriesId: string): string => {
  const { seriesKey, slug } = parseSeriesId(seriesId);
  return new URL(`/series/${seriesKey}/${slug}`, sourceBaseUrl).toString();
};

const createFullChapterListUrl = (seriesId: string): string => {
  const { seriesKey } = parseSeriesId(seriesId);
  return new URL(
    `/series/${seriesKey}/full-chapter-list`,
    sourceBaseUrl
  ).toString();
};

const createChapterUrl = (chapterId: string): string =>
  new URL(`/chapters/${chapterId}`, sourceBaseUrl).toString();

const createChapterImagesUrl = (chapterId: string): string => {
  const url = new URL(`/chapters/${chapterId}/images`, sourceBaseUrl);
  url.searchParams.set("current_page", "1");
  url.searchParams.set("is_prev", "False");
  url.searchParams.set("reading_style", browserReadingStyle);
  return url.toString();
};

const mapStatus = (value: string | null | undefined): SourceSeriesStatus => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "ongoing":
      return "ongoing";
    case "complete":
    case "completed":
      return "completed";
    case "hiatus":
      return "hiatus";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
};

const inferContentRating = (
  tags: string[],
  adultValue: string | null = null
): string | null => {
  if (adultValue?.toLowerCase() === "yes") {
    return "adult";
  }

  const normalizedTags = tags.map((tag) => tag.toLowerCase());

  if (normalizedTags.some((tag) => tag === "adult" || tag === "hentai")) {
    return "adult";
  }

  if (normalizedTags.some((tag) => tag === "mature" || tag === "ecchi")) {
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

const parseSelectOptions = (
  $: CheerioAPI,
  name: string
): SourceFilterOption[] => {
  return $(`input[name="${name}"]`)
    .toArray()
    .map((element) => {
      const input = $(element);
      const label = normalizeText(
        input.closest("label").find("span").first().text()
      );
      const value = normalizeText(input.attr("value"));

      return {
        label,
        value,
      };
    })
    .filter((option) => option.label.length > 0 && option.value.length > 0);
};

const getDefaultSelectValue = (
  $: CheerioAPI,
  name: string
): string | undefined => {
  return (
    nullableText($(`input[name="${name}"][checked]`).first().attr("value")) ??
    undefined
  );
};

const getCachedFilters = async (): Promise<SourceFilterDefinition[]> => {
  if (cachedFilters && cachedFilters.expiresAt > Date.now()) {
    return cachedFilters.filters;
  }

  const { html } = await fetchHtmlPage(searchPageUrl);
  const $ = loadDocument(html);
  const filters: SourceFilterDefinition[] = [
    {
      defaultValue: getDefaultSelectValue($, "sort"),
      key: "sort",
      label: "Sort by",
      options: parseSelectOptions($, "sort"),
      type: "select",
    },
    {
      defaultValue: getDefaultSelectValue($, "order"),
      key: "order",
      label: "Order",
      options: parseSelectOptions($, "order"),
      type: "select",
    },
    {
      defaultValue: getDefaultSelectValue($, "official"),
      key: "official",
      label: "Official translation",
      options: parseSelectOptions($, "official"),
      type: "select",
    },
    {
      defaultValue: getDefaultSelectValue($, "anime"),
      key: "anime",
      label: "Anime adaptation",
      options: parseSelectOptions($, "anime"),
      type: "select",
    },
    {
      defaultValue: getDefaultSelectValue($, "adult"),
      key: "adult",
      label: "Adult content",
      options: parseSelectOptions($, "adult"),
      type: "select",
    },
    {
      key: "included_status",
      label: "Series status",
      options: parseSelectOptions($, "included_status"),
      type: "multiSelect",
    },
    {
      key: "included_type",
      label: "Series type",
      options: parseSelectOptions($, "included_type"),
      type: "multiSelect",
    },
  ];

  cachedFilters = {
    expiresAt: Date.now() + filterCacheTtlMs,
    filters,
  };

  return filters;
};

const getFilterStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
};

const applySearchFilters = (
  searchParams: URLSearchParams,
  filters: Record<string, unknown> | undefined,
  sort: string,
  order = "Descending"
): void => {
  searchParams.set("adult", "Any");
  searchParams.set("anime", "Any");
  searchParams.set("display_mode", searchDisplayMode);
  searchParams.set("official", "Any");
  searchParams.set("order", order);
  searchParams.set("sort", sort);

  if (!filters) {
    return;
  }

  for (const key of ["official", "anime", "adult", "order", "sort"] as const) {
    const value = getFilterStrings(filters[key])[0];

    if (value) {
      searchParams.set(key, value);
    }
  }

  for (const key of ["included_status", "included_type"] as const) {
    for (const value of getFilterStrings(filters[key])) {
      searchParams.append(key, value);
    }
  }
};

const parseSearchResultCard = (
  $: CheerioAPI,
  element: Parameters<CheerioAPI>[0]
): SourceSeries | null => {
  const card = $(element);
  const details = card.children("section").last();
  const href = card.find('a[href*="/series/"]').first().attr("href");

  if (!href) {
    return null;
  }

  const canonicalUrl = resolveUrl(sourceBaseUrl, href);
  const context = parseSeriesContext(canonicalUrl);
  const coverImageUrl = nullableText(
    card.find('picture img[alt*="cover"]').first().attr("src")
      ? resolveUrl(
          sourceBaseUrl,
          card.find('picture img[alt*="cover"]').first().attr("src") ?? ""
        )
      : null
  );
  const title = cleanTitle(
    details.find('a[href*="/series/"]').last().text() ||
      card.find("h2").first().text(),
    context.slug.replace(/-/g, " ")
  );
  const tags = uniqueStrings(
    details
      .find("strong")
      .filter((_, strong) =>
        normalizeText($(strong).text()).startsWith("Tag(s)")
      )
      .parent()
      .find("span")
      .toArray()
      .map((tag) =>
        normalizeText($(tag).text()).replace(trailingCommaPattern, "")
      )
  );
  const authorNames = uniqueStrings(
    details
      .find("strong")
      .filter((_, strong) =>
        normalizeText($(strong).text()).startsWith("Author")
      )
      .parent()
      .find("a")
      .toArray()
      .map((author) => $(author).text())
  );
  const status = mapStatus(
    details
      .find("strong")
      .filter((_, strong) =>
        normalizeText($(strong).text()).startsWith("Status")
      )
      .parent()
      .find("span")
      .last()
      .text()
  );

  return {
    artistNames: [],
    authorNames,
    availableTranslatedLanguages: [sourceLanguage],
    canonicalUrl: context.canonicalUrl,
    contentRating: inferContentRating(tags),
    coverImageUrl,
    description: null,
    externalId: context.externalId,
    latestChapter: null,
    originalLanguage: null,
    publicationDemographic: inferPublicationDemographic(tags),
    status,
    tags,
    title,
  };
};

const cleanTitle = (
  value: string | null | undefined,
  fallback: string
): string => {
  return (normalizeText(value) || fallback)
    .replace(titleSuffixPattern, "")
    .trim();
};

const searchSeriesList = async (
  input: SourceSearchInput,
  sort: string,
  order = "Descending"
): Promise<SourceListResponse<SourceSeries>> => {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const searchParams = new URLSearchParams();

  searchParams.set("limit", String(pageSize));
  searchParams.set("offset", String((page - 1) * pageSize));
  searchParams.set("text", input.query?.trim() ?? "");
  applySearchFilters(searchParams, input.filters, sort, order);

  const { html } = await fetchHtmlPage(
    new URL(`search/data?${searchParams.toString()}`, sourceBaseUrl)
  );
  const $ = loadDocument(html);
  const items = $("article")
    .toArray()
    .map((element) => parseSearchResultCard($, element))
    .filter((item): item is SourceSeries => item !== null);

  return {
    hasNextPage: items.length === pageSize,
    items,
    page,
    pageSize,
    total: null,
  };
};

const getDetailValue = ($: CheerioAPI, label: string): string | null => {
  const strong = $("strong")
    .toArray()
    .find((element) => normalizeText($(element).text()) === label);

  if (!strong) {
    return null;
  }

  const container = $(strong).parent();
  const linkValues = uniqueStrings(
    container
      .find("a")
      .toArray()
      .map((link) => $(link).text())
  );

  if (linkValues.length > 0) {
    return linkValues.join(", ");
  }

  const text = normalizeText(container.text()).replace(label, "").trim();
  return nullableText(text);
};

const getDetailList = ($: CheerioAPI, label: string): string[] => {
  const strong = $("strong")
    .toArray()
    .find((element) => normalizeText($(element).text()) === label);

  if (!strong) {
    return [];
  }

  const container = $(strong).parent();
  const linkValues = uniqueStrings(
    container
      .find("a")
      .toArray()
      .map((link) => $(link).text())
  );

  if (linkValues.length > 0) {
    return linkValues;
  }

  return uniqueStrings(
    container
      .find("span")
      .toArray()
      .map((span) =>
        normalizeText($(span).text()).replace(trailingCommaPattern, "")
      )
  );
};

const parseLatestChapterLabel = ($: CheerioAPI): string | null => {
  const latestLinkText = normalizeText(
    $("#chapter-list a[href*='/chapters/'] span.grow span").first().text()
  );
  const match = chapterNumberPattern.exec(latestLinkText);
  return match?.[1] ?? null;
};

const fetchSeriesDetail = async (
  seriesId: string
): Promise<{ context: WeebCentralSeriesContext; html: string }> => {
  const { html, response } = await fetchHtmlPage(createSeriesUrl(seriesId));

  return {
    context: parseSeriesContext(response.url),
    html,
  };
};

const parseSeriesDetail = (
  html: string,
  context: WeebCentralSeriesContext
): SourceSeries => {
  const $ = loadDocument(html);
  const tags = getDetailList($, "Tags(s):");
  const adultContent = getDetailValue($, "Adult Content:");

  return {
    artistNames: [],
    authorNames: getDetailList($, "Author(s):"),
    availableTranslatedLanguages: [sourceLanguage],
    canonicalUrl: context.canonicalUrl,
    contentRating: inferContentRating(tags, adultContent),
    coverImageUrl: nullableText(
      $("meta[property='og:image']").attr("content") ??
        $("img[alt*='cover']").first().attr("src")
    ),
    description: nullableText(
      $("strong")
        .filter(
          (_, strong) => normalizeText($(strong).text()) === "Description"
        )
        .parent()
        .find("p")
        .first()
        .text()
    ),
    externalId: context.externalId,
    latestChapter: parseLatestChapterLabel($),
    originalLanguage: null,
    publicationDemographic: inferPublicationDemographic(tags),
    status: mapStatus(getDetailValue($, "Status:")),
    tags,
    title: cleanTitle($("title").text(), context.slug.replace(/-/g, " ")),
  };
};

const parseChapterId = (url: string): string | null => {
  const match = chapterPathPattern.exec(new URL(url).pathname);
  return match?.groups?.chapterId ?? null;
};

const parseChapters = (html: string): SourceChapter[] => {
  const $ = loadDocument(html);
  const seenChapterIds = new Set<string>();

  const chapters = $("a[href*='/chapters/']")
    .toArray()
    .map((element) => {
      const link = $(element);
      const href = link.attr("href");

      if (!href) {
        return null;
      }

      const chapterUrl = resolveUrl(sourceBaseUrl, href);
      const chapterId = parseChapterId(chapterUrl);

      if (!chapterId || seenChapterIds.has(chapterId)) {
        return null;
      }

      seenChapterIds.add(chapterId);

      const chapterLabel = normalizeText(
        link.find("span.grow span").first().text() || link.text()
      );
      const chapterNumber =
        chapterNumberPattern.exec(chapterLabel)?.[1] ?? null;
      const title = nullableText(chapterLabel.replace(titlePrefixPattern, ""));
      const publishedAtValue = nullableText(link.find("time").attr("datetime"));

      return {
        chapterNumber,
        externalId: chapterId,
        externalUrl: chapterUrl,
        isUnavailable: false,
        pageCount: null,
        publishedAt: publishedAtValue ? new Date(publishedAtValue) : null,
        sourceOrder: chapterNumber ?? chapterId,
        title: title && title !== chapterLabel ? title : null,
        translatedLanguage: sourceLanguage,
        volumeNumber: null,
      } satisfies SourceChapter;
    })
    .filter((chapter) => chapter !== null);

  return chapters as SourceChapter[];
};

const parsePageImageUrls = (html: string): string[] => {
  const $ = loadDocument(html);
  const urls = uniqueStrings(
    $(pageImageSelector)
      .toArray()
      .map((image) => $(image).attr("src") ?? "")
      .filter(Boolean)
  );

  if (urls.length > 0) {
    return urls;
  }

  return uniqueStrings(
    [...html.matchAll(pageImagePattern)].map((match) => match[0])
  );
};

const renderChapterPageImages = (chapterId: string): Promise<string[]> => {
  const chapterUrl = createChapterUrl(chapterId);

  return withBrowserPage(
    chapterUrl,
    async (page) => {
      const imageUrls = await page.evaluate((selector: string) => {
        return Array.from(document.querySelectorAll(selector))
          .map((image) => {
            const element = image as HTMLImageElement;
            return element.src || element.dataset.src || "";
          })
          .filter((value) => value.includes("/manga/"));
      }, pageImageSelector);

      return imageUrls;
    },
    {
      localStorage: {
        reading_style: browserReadingStyle,
      },
      referer: chapterUrl,
      scrollToBottom: true,
      waitAfterLoadMs: 2000,
      waitForSelector: pageImageSelector,
    }
  );
};

export const createWeebCentralSourceAdapter = (
  dependencies: Partial<WeebCentralDependencies> = {}
): SourceAdapter => {
  const browserChapterImageRenderer =
    dependencies.renderChapterPageImages ?? renderChapterPageImages;

  return {
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
        "WeebCentral adapter with normalized search, discovery, chapter feeds, and browser-assisted page extraction.",
      iconUrl: new URL("/static/images/brand.png", sourceBaseUrl).toString(),
      id: "weebCentral",
      languageCode: sourceLanguage,
      name: "WeebCentral",
      supportedLanguages: [sourceLanguage],
      websiteUrl: sourceBaseUrl,
    },
    getFilters() {
      return getCachedFilters();
    },
    getPopular(page, pageSize) {
      return searchSeriesList(
        {
          page,
          pageSize,
        },
        "Popularity"
      );
    },
    getLatest(page, pageSize) {
      return searchSeriesList(
        {
          page,
          pageSize,
        },
        "Latest Updates"
      );
    },
    searchSeries(input) {
      return searchSeriesList(input, "Best Match", "Ascending");
    },
    async getSeries(seriesId) {
      const { context, html } = await fetchSeriesDetail(seriesId);
      return parseSeriesDetail(html, context);
    },
    async getChapters(seriesId) {
      const { html } = await fetchHtmlPage(createFullChapterListUrl(seriesId));
      return parseChapters(html);
    },
    async getPages(chapterId) {
      let imageUrls: string[] = [];

      try {
        imageUrls = await browserChapterImageRenderer(chapterId);
      } catch (error) {
        if (!(error instanceof BrowserUnavailableError)) {
          imageUrls = [];
        }
      }

      if (imageUrls.length === 0) {
        const { html } = await fetchHtmlPage(
          createChapterImagesUrl(chapterId),
          {
            referer: createChapterUrl(chapterId),
          }
        );
        imageUrls = parsePageImageUrls(html);
      }

      const chapterUrl = createChapterUrl(chapterId);
      const pages: SourcePage[] = imageUrls.map((imageUrl, index) => ({
        headers: { ...imageRequestHeaders },
        imageUrl,
        index,
        referer: chapterUrl,
      }));

      const pageList: SourcePageList = {
        pages,
      };

      return pageList;
    },
  };
};
