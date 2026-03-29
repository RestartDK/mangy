import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { createMangaworldSourceAdapter } from "../src/adapters/manga-world";

const fixture = async (name: string): Promise<string> =>
  readFile(new URL(`./fixtures/manga-world/${name}`, import.meta.url), "utf8");

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

describe("MangaWorld adapter", () => {
  const originalFetch = globalThis.fetch;
  const adapter = createMangaworldSourceAdapter();

  beforeEach(async () => {
    const archiveHtml = await fixture("archive.html");
    const readerHtml = await fixture("reader.html");
    const seriesHtml = await fixture("series.html");

    globalThis.fetch = ((input) => {
      const requestUrl = toRequestUrl(input);
      const url = new URL(requestUrl);

      if (url.pathname === "/archive") {
        return Promise.resolve(createHtmlResponse(archiveHtml, url.toString()));
      }

      if (url.pathname === "/manga/1708") {
        return Promise.resolve(
          createHtmlResponse(
            seriesHtml,
            "https://www.mangaworld.mx/manga/1708/one-piece/"
          )
        );
      }

      if (
        url.pathname === "/manga/1708/one-piece/read/69c6806c6f6bd712dbdf7b8d/1"
      ) {
        return Promise.resolve(createHtmlResponse(readerHtml, url.toString()));
      }

      throw new Error(`Unexpected fetch request: ${url.toString()}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("parses filters and search results", async () => {
    const filters = await adapter.getFilters();
    const searchResult = await adapter.searchSeries({
      page: 1,
      pageSize: 2,
      query: "one piece",
    });

    expect(filters.length).toBeGreaterThanOrEqual(5);
    expect(filters[0]?.key).toBe("genre");
    expect(searchResult.items).toHaveLength(2);
    expect(searchResult.items[0]).toMatchObject({
      authorNames: ["ODA Eiichiro"],
      externalId: "1708",
      status: "ongoing",
      title: "One Piece",
    });
    expect(searchResult.total).toBe(2);
    expect(searchResult.hasNextPage).toBe(false);
  });

  test("parses series details, chapters, and reader pages", async () => {
    const series = await adapter.getSeries("1708");
    const chapters = await adapter.getChapters("1708");
    const pages = await adapter.getPages(chapters[0]?.externalId ?? "");

    expect(series).toMatchObject({
      authorNames: ["ODA Eiichiro"],
      availableTranslatedLanguages: ["it"],
      externalId: "1708",
      latestChapter: "1178",
      title: "One Piece",
    });
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({
      chapterNumber: "1178",
      externalId: "1708:one-piece:69c6806c6f6bd712dbdf7b8d",
      translatedLanguage: "it",
      volumeNumber: "115",
    });
    expect(pages.pages).toHaveLength(3);
    expect(pages.pages[0]).toMatchObject({
      imageUrl:
        "https://cdn.mangaworld.mx/chapters/one-piece-5fa0c9e2c9f2201ee55d3bd4/volume-115-69bee2bebb4efa5a7ff47789/capitolo-1178-69c6806c6f6bd712dbdf7b8d/1.jpg",
      index: 0,
      referer:
        "https://www.mangaworld.mx/manga/1708/one-piece/read/69c6806c6f6bd712dbdf7b8d/1?style=list",
    });
    expect(pages.pages[0]?.headers?.Accept).toContain("image/");
  });
});
