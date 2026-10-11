import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { createWeebCentralSourceAdapter } from "../src/adapters/weeb-central";

const fixture = async (name: string): Promise<string> =>
  await readFile(
    new URL(`fixtures/weeb-central/${name}`, import.meta.url),
    "utf-8"
  );

const createHtmlResponse = (html: string, url: string): Response => {
  const response = new Response(html, {
    headers: { "content-type": "text/html" },
    status: 200,
  });

  Object.defineProperty(response, "url", { value: url });

  return response;
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

  beforeEach(() => {
    const fixtureByPath = new Map<string, string>([
      ["/chapters/01KMRF9PB6E2R9KVZQ3SDWQZNG/images", "images.html"],
      ["/search", "search.html"],
      ["/search/data", "search-results.html"],
      ["/series/01J76XY7E9FNDZ1DBBM6PBJPFK/One-Piece", "series.html"],
      ["/series/01J76XY7E9FNDZ1DBBM6PBJPFK/full-chapter-list", "chapters.html"],
    ]);

    globalThis.fetch = async (input) => {
      const requestUrl = toRequestUrl(input);
      const url = new URL(requestUrl);
      const fixtureName = fixtureByPath.get(url.pathname);

      if (fixtureName === undefined) {
        throw new Error(`Unexpected fetch request: ${url.toString()}`);
      }

      return createHtmlResponse(await fixture(fixtureName), url.toString());
    };
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
