import { expect, test } from "bun:test";

import { Effect } from "effect";

import { withBrowserPage } from "../src/adapters/shared/browser";
import { createWeebCentralSourceAdapter } from "../src/adapters/weeb-central";

const liveSourceTestsEnabled = process.env.LIVE_SOURCE_TESTS === "1";

if (liveSourceTestsEnabled) {
  test("WeebCentral live smoke fetches series, chapters, and pages", async () => {
    const adapter = createWeebCentralSourceAdapter();
    const popular = await Effect.runPromise(adapter.getPopular(1, 1));
    const [firstSeries] = popular.items;

    expect(firstSeries).toBeDefined();
    expect(firstSeries?.externalId).toBeString();
    expect(firstSeries?.title.length ?? 0).toBeGreaterThan(0);

    const series = await Effect.runPromise(
      adapter.getSeries(firstSeries?.externalId ?? "")
    );
    const chapters = await Effect.runPromise(
      adapter.getChapters(series.externalId)
    );
    const firstChapter = chapters.find((chapter) => !chapter.isUnavailable);

    expect(series.title.length).toBeGreaterThan(0);
    expect(chapters.length).toBeGreaterThan(0);
    expect(firstChapter).toBeDefined();
    expect(firstChapter?.externalId).toBeString();

    const pages = await Effect.runPromise(
      adapter.getPages(firstChapter?.externalId ?? "")
    );

    expect(pages.pages.length).toBeGreaterThan(0);
    expect(pages.pages[0]?.imageUrl.startsWith("https://")).toBe(true);
    expect(pages.pages[0]?.referer).toBeString();
  });

  test("WeebCentral live search pages past the first window", async () => {
    const adapter = createWeebCentralSourceAdapter();
    const first = await Effect.runPromise(
      adapter.searchSeries({ page: 1, pageSize: 12, query: "one" })
    );
    const second = await Effect.runPromise(
      adapter.searchSeries({ page: 2, pageSize: 12, query: "one" })
    );
    const firstIds = new Set(first.items.map((item) => item.externalId));

    expect(first.items).toHaveLength(12);
    expect(first.hasNextPage).toBe(true);
    expect(second.items).toHaveLength(12);
    expect(second.items.some((item) => firstIds.has(item.externalId))).toBe(
      false
    );
  });

  test("browser helper renders WeebCentral chapter pages with page images", async () => {
    const adapter = createWeebCentralSourceAdapter();
    const popular = await Effect.runPromise(adapter.getPopular(1, 1));
    const series = await Effect.runPromise(
      adapter.getSeries(popular.items[0]?.externalId ?? "")
    );
    const chapters = await Effect.runPromise(
      adapter.getChapters(series.externalId)
    );
    const firstChapter = chapters.find((chapter) => !chapter.isUnavailable);

    expect(firstChapter).toBeDefined();

    const imageCount = await Effect.runPromise(
      withBrowserPage(
        `https://weebcentral.com/chapters/${firstChapter?.externalId ?? ""}`,
        (page) =>
          Effect.promise(
            async () =>
              await page.evaluate(
                () => document.querySelectorAll('img[alt^="Page"]').length
              )
          ),
        {
          localStorage: {
            reading_style: "long_strip",
          },
          scrollToBottom: true,
          waitAfterLoadMs: 2000,
          waitForSelector: 'img[alt^="Page"]',
        }
      )
    );

    expect(imageCount).toBeGreaterThan(0);
  });
}
