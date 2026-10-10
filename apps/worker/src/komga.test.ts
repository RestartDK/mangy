import { afterEach, describe, expect, test } from "bun:test";

import { serve } from "bun";

import { scanKomgaLibrary, setKomgaConfigForTests } from "./komga";

afterEach(() => {
  setKomgaConfigForTests(null);
});

describe("Komga integration", () => {
  test("skips scan when the destination is not tied to a Komga library", async () => {
    const result = await scanKomgaLibrary({ libraryId: null });

    expect(result).toBeNull();
  });

  test("requests a library scan with API key authentication", async () => {
    const requests: Array<{
      authorization: string | null;
      path: string;
      xApiKey: string | null;
    }> = [];
    const server = serve({
      fetch(request) {
        const url = new URL(request.url);
        requests.push({
          authorization: request.headers.get("authorization"),
          path: url.pathname,
          xApiKey: request.headers.get("x-api-key"),
        });

        return new Response(null, { status: 202 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      setKomgaConfigForTests({
        apiKey: "komga-test-key",
        baseUrl: `http://127.0.0.1:${server.port}/`,
        password: undefined,
        username: undefined,
      });

      const scannedAt = await scanKomgaLibrary({ libraryId: "library/one" });

      expect(scannedAt).toBeInstanceOf(Date);
      expect(requests).toEqual([
        {
          authorization: null,
          path: "/api/v1/libraries/library%2Fone/scan",
          xApiKey: "komga-test-key",
        },
      ]);
    } finally {
      server.stop(true);
    }
  });

  test("falls back to basic authentication when no API key is configured", async () => {
    const requests: Array<{
      authorization: string | null;
      xApiKey: string | null;
    }> = [];
    const server = serve({
      fetch(request) {
        requests.push({
          authorization: request.headers.get("authorization"),
          xApiKey: request.headers.get("x-api-key"),
        });

        return new Response(null, { status: 204 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      setKomgaConfigForTests({
        apiKey: undefined,
        baseUrl: `http://127.0.0.1:${server.port}`,
        password: "secret",
        username: "admin@example.test",
      });

      const scannedAt = await scanKomgaLibrary({ libraryId: "library-basic" });

      expect(scannedAt).toBeInstanceOf(Date);
      expect(requests).toEqual([
        {
          authorization: `Basic ${Buffer.from("admin@example.test:secret").toString("base64")}`,
          xApiKey: null,
        },
      ]);
    } finally {
      server.stop(true);
    }
  });

  test("raises scan failures with the Komga response status", async () => {
    const server = serve({
      fetch() {
        return new Response("nope", { status: 503 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      setKomgaConfigForTests({
        apiKey: "komga-test-key",
        baseUrl: `http://127.0.0.1:${server.port}`,
        password: undefined,
        username: undefined,
      });

      await expect(
        scanKomgaLibrary({ libraryId: "library-down" })
      ).rejects.toThrow("Komga library scan failed with status 503.");
    } finally {
      server.stop(true);
    }
  });
});
