import { expect, test } from "bun:test";

import { createMangaworldSourceAdapter } from "../src/adapters/manga-world";

const liveSourceTestsEnabled = process.env.LIVE_SOURCE_TESTS === "1";

if (liveSourceTestsEnabled) {
  test("MangaWorld live smoke fetches series, chapters, and pages", async () => {
    const adapter = createMangaworldSourceAdapter();
    const popular = await adapter.getPopular(1, 1);
    const firstSeries = popular.items[0];

    expect(firstSeries).toBeDefined();
    expect(firstSeries?.externalId).toBeString();
    expect(firstSeries?.title.length ?? 0).toBeGreaterThan(0);

    const series = await adapter.getSeries(firstSeries?.externalId ?? "");
    const chapters = await adapter.getChapters(series.externalId);
    const firstChapter = chapters.find((chapter) => !chapter.isUnavailable);

    expect(series.title.length).toBeGreaterThan(0);
    expect(chapters.length).toBeGreaterThan(0);
    expect(firstChapter).toBeDefined();
    expect(firstChapter?.externalId).toBeString();

    const pages = await adapter.getPages(firstChapter?.externalId ?? "");

    expect(pages.pages.length).toBeGreaterThan(0);
    expect(pages.pages[0]?.imageUrl.startsWith("https://")).toBe(true);
    expect(pages.pages[0]?.headers).toBeDefined();
    expect(pages.pages[0]?.referer).toBeString();
  });
}
