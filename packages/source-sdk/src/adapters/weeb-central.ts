import type { CheerioAPI } from "cheerio";
import { Effect } from "effect";

import { SourceParseError } from "../errors";
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
import type { HttpError } from "./shared/http";

const sourceBaseUrl = "https://weebcentral.com/";
const searchPageUrl = new URL("search", sourceBaseUrl);
const sourceLanguage = "en";
const defaultPageSize = 12;
const maxPageSize = 24;
const filterCacheTtlMs = 1000 * 60 * 60;
const pageImageSelector = 'img[alt^="Page"]';
const searchDisplayMode = "Full Display";
const browserReadingStyle = "long_strip";
const pageImagePattern =
  /https?:\/\/temp\.compsci88\.com\/manga\/[^"'\s<>]+/giu;
const trailingCommaPattern = /,$/u;
const titleSuffixPattern = /\s*\|\s*Weeb Central$/iu;
const chapterNumberPattern =
  /chapter\s+(?<chapterNumber>[0-9]+(?:\.[0-9]+)?)/iu;
const titlePrefixPattern = /^chapter\s+[0-9]+(?:\.[0-9]+)?[:\s-]*/iu;
const chapterPathPattern = /\/chapters\/(?<chapterId>[A-Z0-9]+)/iu;
const seriesPathPattern =
  /\/series\/(?<seriesKey>[A-Z0-9]+)(?:\/(?<slug>[^/?#]+))?/iu;

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
  renderChapterPageImages: (
    chapterId: string
  ) => Effect.Effect<string[], BrowserUnavailableError>;
}

interface BrowserImageElement {
  dataset?: {
    src?: string;
  };
  src?: string;
}

interface BrowserDocumentLike {
  querySelectorAll: (selector: string) => Iterable<BrowserImageElement>;
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
    throw new SourceParseError({
      message: `Invalid WeebCentral series id: ${seriesId}`,
    });
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
    throw new SourceParseError({
      message: `Unable to parse WeebCentral series url: ${url}`,
    });
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
    case "ongoing": {
      return "ongoing";
    }
    case "complete":
    case "completed": {
      return "completed";
    }
    case "hiatus": {
      return "hiatus";
    }
    case "canceled":
    case "cancelled": {
      return "cancelled";
    }
    default: {
      return "unknown";
    }
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
): SourceFilterOption[] =>
  $(`input[name="${name}"]`)
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

const getDefaultSelectValue = (
  $: CheerioAPI,
  name: string
): string | undefined =>
  nullableText($(`input[name="${name}"][checked]`).first().attr("value")) ??
  undefined;

const attemptParse = <TResult>(
  evaluate: () => TResult
): Effect.Effect<TResult, SourceParseError> =>
  Effect.try({
    catch: (cause) =>
      cause instanceof SourceParseError
        ? cause
        : new SourceParseError({
            cause,
            message: cause instanceof Error ? cause.message : String(cause),
          }),
    try: evaluate,
  });

const getCachedFilters = (): Effect.Effect<
  SourceFilterDefinition[],
  HttpError
> =>
  Effect.gen(function* getCachedFiltersEffect() {
    if (cachedFilters && cachedFilters.expiresAt > Date.now()) {
      return cachedFilters.filters;
    }

    const { html } = yield* fetchHtmlPage(searchPageUrl);
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
  });

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
    const [value] = getFilterStrings(filters[key]);

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

const cleanTitle = (
  value: string | null | undefined,
  fallback: string
): string =>
  (normalizeText(value) || fallback).replace(titleSuffixPattern, "").trim();

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
  return match?.groups?.chapterNumber ?? null;
};

const fetchSeriesDetail = (
  seriesId: string
): Effect.Effect<
  { context: WeebCentralSeriesContext; html: string },
  HttpError | SourceParseError
> =>
  Effect.gen(function* fetchSeriesDetailEffect() {
    const url = yield* attemptParse(() => createSeriesUrl(seriesId));
    const { html, response } = yield* fetchHtmlPage(url);
    const context = yield* attemptParse(() => parseSeriesContext(response.url));

    return {
      context,
      html,
    };
  });

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
    title: cleanTitle($("title").text(), context.slug.replaceAll("-", " ")),
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
        chapterNumberPattern.exec(chapterLabel)?.groups?.chapterNumber ?? null;
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

  return chapters;
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

const renderChapterPageImages = (
  chapterId: string
): Effect.Effect<string[], BrowserUnavailableError> => {
  const chapterUrl = createChapterUrl(chapterId);

  return withBrowserPage(
    chapterUrl,
    (page) =>
      Effect.tryPromise({
        catch: (cause) =>
          new BrowserUnavailableError({
            cause,
            message: "Unable to read chapter page images.",
          }),
        try: async () =>
          await page.evaluate((selector: string) => {
            const pageDocument = globalThis as unknown as {
              document: BrowserDocumentLike;
            };

            return [...pageDocument.document.querySelectorAll(selector)]
              .map((image) => image.src ?? image.dataset?.src ?? "")
              .filter((value) => value.includes("/manga/"));
          }, pageImageSelector),
      }),
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
    context.slug.replaceAll("-", " ")
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

const searchSeriesList = (
  input: SourceSearchInput,
  sort: string,
  order = "Descending"
): Effect.Effect<
  SourceListResponse<SourceSeries>,
  HttpError | SourceParseError
> =>
  Effect.gen(function* searchSeriesListEffect() {
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(input.pageSize);
    const searchParams = new URLSearchParams();

    searchParams.set("limit", String(pageSize));
    searchParams.set("offset", String((page - 1) * pageSize));
    searchParams.set("text", input.query?.trim() ?? "");
    applySearchFilters(searchParams, input.filters, sort, order);

    const { html } = yield* fetchHtmlPage(
      new URL(`search/data?${searchParams.toString()}`, sourceBaseUrl)
    );
    const items = yield* attemptParse(() => {
      const $ = loadDocument(html);

      return $("article")
        .toArray()
        .map((element) => parseSearchResultCard($, element))
        .filter((item): item is SourceSeries => item !== null);
    });

    return {
      hasNextPage: items.length === pageSize,
      items,
      page,
      pageSize,
      total: null,
    };
  });

export const createWeebCentralSourceAdapter = (
  dependencies: Partial<WeebCentralDependencies> = {}
): SourceAdapter => {
  const browserChapterImageRenderer =
    dependencies.renderChapterPageImages ?? renderChapterPageImages;

  return {
    getChapters: (seriesId) =>
      Effect.gen(function* getChaptersEffect() {
        const url = yield* attemptParse(() =>
          createFullChapterListUrl(seriesId)
        );
        const { html } = yield* fetchHtmlPage(url);

        return parseChapters(html);
      }),
    getFilters: getCachedFilters(),
    getLatest: (page, pageSize) =>
      searchSeriesList({ page, pageSize }, "Latest Updates"),
    getPages: (chapterId) =>
      Effect.gen(function* getPagesEffect() {
        const chapterUrl = createChapterUrl(chapterId);
        const renderedImageUrls = yield* browserChapterImageRenderer(
          chapterId
        ).pipe(
          Effect.catchTag("BrowserUnavailableError", () =>
            Effect.succeed<string[]>([])
          )
        );

        let imageUrls = renderedImageUrls;
        if (imageUrls.length === 0) {
          const { html } = yield* fetchHtmlPage(
            createChapterImagesUrl(chapterId),
            {
              referer: chapterUrl,
            }
          );
          imageUrls = parsePageImageUrls(html);
        }

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
      }),
    getPopular: (page, pageSize) =>
      searchSeriesList({ page, pageSize }, "Popularity"),
    getSeries: (seriesId) =>
      Effect.gen(function* getSeriesEffect() {
        const { context, html } = yield* fetchSeriesDetail(seriesId);

        return parseSeriesDetail(html, context);
      }),
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
    searchSeries: (input) => searchSeriesList(input, "Best Match", "Ascending"),
  };
};
