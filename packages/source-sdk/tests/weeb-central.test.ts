import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { createWeebCentralSourceAdapter } from "../src/adapters/weeb-central";

const fixture = async (name: string): Promise<string> =>
  readFile(new URL(`./fixtures/weeb-central/${name}`, import.meta.url), "utf8");

const createHtmlResponse = (html: string, url: string): Response => {
  return {
    ok: true,
    status: 200,
    text: async () => html,
    url,
  } as unknown as Response;
};

const toRequestUrl = (input: string | URL | Request): string => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
};

describe("WeebCentral adapter", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    const chapterHtml = await fixture("chapters.html");
    const imagesHtml = await fixture("images.html");
    const searchHtml = await fixture("search.html");
    const searchResultsHtml = await fixture("search-results.html");
    const seriesHtml = await fixture("series.html");

    globalThis.fetch = ((input) => {
      const requestUrl = toRequestUrl(input);
      const url = new URL(requestUrl);

      if (url.pathname === "/search") {
        return Promise.resolve(createHtmlResponse(searchHtml, url.toString()));
      }

      if (url.pathname === "/search/data") {
        return Promise.resolve(
          createHtmlResponse(searchResultsHtml, url.toString())
        );
      }

      if (url.pathname === "/series/01J76XY7E9FNDZ1DBBM6PBJPFK/One-Piece") {
        return Promise.resolve(createHtmlResponse(seriesHtml, url.toString()));
      }

      if (
        url.pathname === "/series/01J76XY7E9FNDZ1DBBM6PBJPFK/full-chapter-list"
      ) {
        return Promise.resolve(createHtmlResponse(chapterHtml, url.toString()));
      }

      if (url.pathname === "/chapters/01KMRF9PB6E2R9KVZQ3SDWQZNG/images") {
        return Promise.resolve(createHtmlResponse(imagesHtml, url.toString()));
      }

      throw new Error(`Unexpected fetch request: ${url.toString()}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("parses filters and rich search results", async () => {
    const adapter = createWeebCentralSourceAdapter();
    const filters = await adapter.getFilters();
    const searchResult = await adapter.searchSeries({
      page: 1,
      pageSize: 2,
      query: "one piece",
    });

    expect(filters.length).toBeGreaterThanOrEqual(7);
    expect(filters[0]).toMatchObject({
      defaultValue: "Best Match",
      key: "sort",
      type: "select",
    });
    expect(searchResult.items).toHaveLength(2);
    expect(searchResult.items[0]).toMatchObject({
      authorNames: ["ODA Eiichiro"],
      coverImageUrl:
        "https://temp.compsci88.com/cover/fallback/01J76XY7E9FNDZ1DBBM6PBJPFK.jpg",
      externalId: "01J76XY7E9FNDZ1DBBM6PBJPFK:One-Piece",
      status: "ongoing",
      title: "One Piece",
    });
    expect(searchResult.hasNextPage).toBe(true);
    expect(searchResult.total).toBeNull();
  });

  test("parses series details, chapters, and browser-backed page extraction", async () => {
    const adapter = createWeebCentralSourceAdapter({
      renderChapterPageImages() {
        return [
          "https://temp.compsci88.com/manga/One-Piece/1178-001.png",
          "https://temp.compsci88.com/manga/One-Piece/1178-002.png",
        ];
      },
    });

    const series = await adapter.getSeries(
      "01J76XY7E9FNDZ1DBBM6PBJPFK:One-Piece"
    );
    const chapters = await adapter.getChapters(
      "01J76XY7E9FNDZ1DBBM6PBJPFK:One-Piece"
    );
    const pages = await adapter.getPages("01KMRF9PB6E2R9KVZQ3SDWQZNG");

    expect(series).toMatchObject({
      authorNames: ["ODA Eiichiro"],
      externalId: "01J76XY7E9FNDZ1DBBM6PBJPFK:One-Piece",
      latestChapter: "1178",
      title: "One Piece",
    });
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({
      chapterNumber: "1178",
      externalId: "01KMRF9PB6E2R9KVZQ3SDWQZNG",
      translatedLanguage: "en",
    });
    expect(pages.pages).toEqual([
      {
        headers: {
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        imageUrl: "https://temp.compsci88.com/manga/One-Piece/1178-001.png",
        index: 0,
        referer: "https://weebcentral.com/chapters/01KMRF9PB6E2R9KVZQ3SDWQZNG",
      },
      {
        headers: {
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        imageUrl: "https://temp.compsci88.com/manga/One-Piece/1178-002.png",
        index: 1,
        referer: "https://weebcentral.com/chapters/01KMRF9PB6E2R9KVZQ3SDWQZNG",
      },
    ]);
  });

  test("falls back to the chapter images endpoint when browser rendering is unavailable", async () => {
    const adapter = createWeebCentralSourceAdapter({
      renderChapterPageImages() {
        throw new Error("browser unavailable");
      },
    });

    const pages = await adapter.getPages("01KMRF9PB6E2R9KVZQ3SDWQZNG");

    expect(pages.pages).toHaveLength(3);
    expect(pages.pages[2]).toMatchObject({
      imageUrl: "https://temp.compsci88.com/manga/One-Piece/1178-003.png",
      index: 2,
    });
  });
});
