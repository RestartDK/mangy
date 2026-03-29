import { db } from "@mangy/db";
import { user } from "@mangy/db/schema";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import { request as playwrightRequest } from "playwright";

import { app } from "../src/index";

const liveSourceTestsEnabled = process.env.LIVE_SOURCE_TESTS === "1";
const sessionCookiePattern = /better-auth\.session_token=([^;]+)/;
const liveSourceIds = ["mangaWorld", "weebCentral"] as const;

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(message);
  }
};

const signUpAndGetSessionCookie = async (
  baseUrl: string,
  email: string,
  password: string
): Promise<string> => {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email,
      name: "Live Source Smoke",
      password,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const responseText = await response.text();
  assert(
    response.ok,
    `Sign-up failed with status ${response.status}: ${responseText}`
  );

  const setCookieHeader = response.headers.get("set-cookie") ?? "";
  const sessionMatch = sessionCookiePattern.exec(setCookieHeader);

  assert(sessionMatch, "Sign-up did not return a Better Auth session cookie.");
  return `better-auth.session_token=${sessionMatch[1]}`;
};

if (liveSourceTestsEnabled) {
  const email = `live-routes-${crypto.randomUUID()}@example.com`;
  const password = "live-routes-password-123";
  const server = serve({
    fetch(request) {
      return app.handle(request);
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  const baseUrl = `http://127.0.0.1:${server.port}`;
  let requestContext: Awaited<
    ReturnType<typeof playwrightRequest.newContext>
  > | null = null;

  try {
    const sessionCookie = await signUpAndGetSessionCookie(
      baseUrl,
      email,
      password
    );

    requestContext = await playwrightRequest.newContext({
      extraHTTPHeaders: {
        cookie: sessionCookie,
      },
    });

    const sourcesResponse = await requestContext.get(`${baseUrl}/api/sources`);
    assert(
      sourcesResponse.status() === 200,
      `Sources route failed: ${sourcesResponse.status()} ${await sourcesResponse.text()}`
    );
    const sources = (await sourcesResponse.json()) as Array<{ id: string }>;

    for (const sourceId of liveSourceIds) {
      assert(
        sources.some((source) => source.id === sourceId),
        `${sourceId} was not present in the source registry response.`
      );

      const filtersResponse = await requestContext.get(
        `${baseUrl}/api/sources/${sourceId}/filters`
      );
      assert(
        filtersResponse.status() === 200,
        `${sourceId} filters route failed: ${filtersResponse.status()} ${await filtersResponse.text()}`
      );

      const discoverResponse = await requestContext.get(
        `${baseUrl}/api/sources/${sourceId}/discover?limit=1`
      );
      assert(
        discoverResponse.status() === 200,
        `${sourceId} discover route failed: ${discoverResponse.status()} ${await discoverResponse.text()}`
      );

      const searchResponse = await requestContext.post(
        `${baseUrl}/api/sources/${sourceId}/search`,
        {
          data: {
            page: 1,
            pageSize: 1,
            query: "one piece",
          },
        }
      );
      assert(
        searchResponse.status() === 200,
        `${sourceId} search route failed: ${searchResponse.status()} ${await searchResponse.text()}`
      );
      const searchResult = (await searchResponse.json()) as {
        items: Array<{ seriesId: string; title: string }>;
      };
      const firstSeries = searchResult.items[0];

      assert(firstSeries, `${sourceId} search did not return any live series.`);

      const seriesResponse = await requestContext.get(
        `${baseUrl}/api/series/${encodeURIComponent(firstSeries.seriesId)}?sourceId=${sourceId}`
      );
      assert(
        seriesResponse.status() === 200,
        `${sourceId} series route failed: ${seriesResponse.status()} ${await seriesResponse.text()}`
      );

      const chaptersResponse = await requestContext.get(
        `${baseUrl}/api/series/${encodeURIComponent(firstSeries.seriesId)}/chapters?sourceId=${sourceId}`
      );
      assert(
        chaptersResponse.status() === 200,
        `${sourceId} chapters route failed: ${chaptersResponse.status()} ${await chaptersResponse.text()}`
      );
      const chapters = (await chaptersResponse.json()) as Array<{
        chapterId: string;
        isUnavailable: boolean;
      }>;
      const firstChapter = chapters.find((chapter) => !chapter.isUnavailable);

      assert(
        firstChapter,
        `${sourceId} chapter route did not return any available chapters.`
      );

      const pagesResponse = await requestContext.get(
        `${baseUrl}/api/series/${encodeURIComponent(firstSeries.seriesId)}/chapters/${encodeURIComponent(firstChapter.chapterId)}/pages?sourceId=${sourceId}`
      );
      assert(
        pagesResponse.status() === 200,
        `${sourceId} pages route failed: ${pagesResponse.status()} ${await pagesResponse.text()}`
      );
      const pageList = (await pagesResponse.json()) as {
        pages: Array<{ imageUrl: string; index: number }>;
      };
      const firstPage = pageList.pages[0];

      assert(firstPage, `${sourceId} pages route returned an empty page list.`);

      const imageResponse = await requestContext.get(firstPage.imageUrl);
      assert(
        imageResponse.status() === 200,
        `${sourceId} image proxy route failed: ${imageResponse.status()} ${await imageResponse.text()}`
      );

      const contentType = imageResponse.headers()["content-type"] ?? "";
      assert(
        contentType.startsWith("image/"),
        `${sourceId} image proxy route returned unexpected content type: ${contentType}`
      );

      const imageBody = await imageResponse.body();
      assert(
        imageBody.length > 0,
        `${sourceId} image proxy route returned an empty body.`
      );

      console.log(
        `Live route smoke passed for ${sourceId}: ${firstSeries.seriesId} / ${firstChapter.chapterId}`
      );
    }
  } finally {
    await requestContext?.dispose();
    server.stop(true);
    await db.delete(user).where(eq(user.email, email));
  }
} else {
  console.log(
    "Skipping live route smoke test. Set LIVE_SOURCE_TESTS=1 to run it."
  );
}
