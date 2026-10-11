import { afterEach, describe, expect, test } from "bun:test";

import { Effect, Exit } from "effect";

import { fetchHtmlPage, HttpError } from "../src/adapters/shared/http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const stubFetch = (
  handler: (call: number) => Response | Promise<Response>
): (() => number) => {
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return await handler(calls);
  };

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

    const outcome = await Effect.runPromiseExit(
      fetchHtmlPage("https://example.test/x")
    );

    expect(Exit.isFailure(outcome)).toBe(true);
    expect(calls()).toBe(1);
  });

  test("retries a 5xx until it succeeds", async () => {
    const calls = stubFetch((call) =>
      call < 3
        ? new Response("busy", { status: 503 })
        : htmlResponse("<p>ok</p>")
    );

    const result = await Effect.runPromise(
      fetchHtmlPage("https://example.test/x")
    );

    expect(result.html).toBe("<p>ok</p>");
    expect(calls()).toBe(3);
  });

  test("retries a 429", async () => {
    const calls = stubFetch((call) =>
      call === 1
        ? new Response("slow down", { status: 429 })
        : htmlResponse("<p>ok</p>")
    );

    await Effect.runPromise(fetchHtmlPage("https://example.test/x"));

    expect(calls()).toBe(2);
  });

  test("stops after the configured retry count", async () => {
    const calls = stubFetch(() => new Response("busy", { status: 500 }));

    const outcome = await Effect.runPromiseExit(
      fetchHtmlPage("https://example.test/x", { retries: 1 })
    );

    expect(Exit.isFailure(outcome)).toBe(true);
    expect(calls()).toBe(2);
  });

  test("reports the status and retryability on failure", async () => {
    stubFetch(() => new Response("nope", { status: 404 }));

    const failure = await Effect.runPromise(
      Effect.flip(fetchHtmlPage("https://example.test/x"))
    );

    expect(failure).toBeInstanceOf(HttpError);
    if (!(failure instanceof HttpError)) {
      throw new Error("Expected the request to fail with an HttpError.");
    }
    expect(failure.status).toBe(404);
    expect(failure.retryable).toBe(false);
  });
});
