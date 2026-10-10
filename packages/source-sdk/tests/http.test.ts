import { afterEach, describe, expect, test } from "bun:test";

import {
  fetchHtmlPage,
  HttpError,
} from "../src/adapters/shared/http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const stubFetch = (
  handler: (call: number) => Response | Promise<Response>
): (() => number) => {
  let calls = 0;

  globalThis.fetch = (() => {
    calls += 1;
    return Promise.resolve(handler(calls));
  }) as typeof fetch;

  return () => calls;
};

const htmlResponse = (body: string): Response =>
  new Response(body, {
    headers: { "content-type": "text/html" },
    status: 200,
  });

describe("fetchHtmlPage retry policy", () => {
  test("does not retry a permanent 4xx", async () => {
    const calls = stubFetch(() => new Response("nope", { status: 404 }));

    await expect(fetchHtmlPage("https://example.test/x")).rejects.toThrow();
    expect(calls()).toBe(1);
  });

  test("retries a 5xx until it succeeds", async () => {
    const calls = stubFetch((call) =>
      call < 3 ? new Response("busy", { status: 503 }) : htmlResponse("<p>ok</p>")
    );

    const result = await fetchHtmlPage("https://example.test/x");

    expect(result.html).toBe("<p>ok</p>");
    expect(calls()).toBe(3);
  });

  test("retries a 429", async () => {
    const calls = stubFetch((call) =>
      call === 1
        ? new Response("slow down", { status: 429 })
        : htmlResponse("<p>ok</p>")
    );

    await fetchHtmlPage("https://example.test/x");

    expect(calls()).toBe(2);
  });

  test("stops after the configured retry count", async () => {
    const calls = stubFetch(() => new Response("busy", { status: 500 }));

    await expect(
      fetchHtmlPage("https://example.test/x", { retries: 1 })
    ).rejects.toThrow();

    expect(calls()).toBe(2);
  });

  test("reports the status and retryability on failure", async () => {
    stubFetch(() => new Response("nope", { status: 404 }));

    const failure = await fetchHtmlPage("https://example.test/x").catch(
      (cause: unknown) => cause
    );

    expect(failure).toBeInstanceOf(HttpError);
    expect((failure as HttpError).status).toBe(404);
    expect((failure as HttpError).retryable).toBe(false);
  });
});
