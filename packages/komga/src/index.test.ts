import { afterEach, describe, expect, test } from "bun:test";

import { serve } from "bun";

import {
  listKomgaLibraries,
  scanKomgaLibrary,
  setKomgaConfigForTests,
} from "./index";

afterEach(() => {
  setKomgaConfigForTests(null);
});

describe("Komga integration", () => {
  test("skips scan when the destination is not tied to a Komga library", async () => {
    const result = await scanKomgaLibrary({ libraryId: null });

    expect(result).toBeNull();
  });

  test("requests a library scan with API key authentication", async () => {
    const requests: {
      authorization: string | null;
      path: string;
      xApiKey: string | null;
    }[] = [];
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
      void server.stop(true);
    }
  });

  test("falls back to basic authentication when no API key is configured", async () => {
    const requests: {
      authorization: string | null;
      xApiKey: string | null;
    }[] = [];
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
      void server.stop(true);
    }
  });

  test("raises scan failures with the Komga response status", () => {
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

      expect(scanKomgaLibrary({ libraryId: "library-down" })).rejects.toThrow(
        "Komga library scan failed with status 503."
      );
    } finally {
      void server.stop(true);
    }
  });

  test("reads only the library fields a destination needs", async () => {
    const requests: {
      path: string;
      xApiKey: string | null;
    }[] = [];
    const server = serve({
      fetch(request) {
        const url = new URL(request.url);
        requests.push({
          path: url.pathname,
          xApiKey: request.headers.get("x-api-key"),
        });

        return Response.json([
          {
            hashFiles: false,
            id: "library-one",
            name: "Manga",
            oneshotsDirectory: "",
            root: "/srv/media/books",
            scanCbx: true,
          },
        ]);
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

      const libraries = await listKomgaLibraries();

      expect(libraries).toEqual([
        { id: "library-one", name: "Manga", root: "/srv/media/books" },
      ]);
      expect(requests).toEqual([
        { path: "/api/v1/libraries", xApiKey: "komga-test-key" },
      ]);
    } finally {
      void server.stop(true);
    }
  });

  test("raises list failures with the Komga response status", () => {
    const server = serve({
      fetch() {
        return new Response("nope", { status: 401 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      setKomgaConfigForTests({
        apiKey: undefined,
        baseUrl: `http://127.0.0.1:${server.port}`,
        password: undefined,
        username: undefined,
      });

      expect(listKomgaLibraries()).rejects.toThrow(
        "Komga library list failed with status 401."
      );
    } finally {
      void server.stop(true);
    }
  });

  test("refuses to list libraries without a base URL", () => {
    setKomgaConfigForTests({
      apiKey: undefined,
      baseUrl: undefined,
      password: undefined,
      username: undefined,
    });

    expect(listKomgaLibraries()).rejects.toThrow(
      "KOMGA_BASE_URL is not configured."
    );
  });

  test("gives up on a Komga slower than the timeout", () => {
    const server = serve({
      async fetch() {
        await Bun.sleep(5500);

        return new Response(null, { status: 500 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      setKomgaConfigForTests({
        apiKey: undefined,
        baseUrl: `http://127.0.0.1:${server.port}`,
        password: undefined,
        username: undefined,
      });

      expect(listKomgaLibraries()).rejects.toThrow(
        "Komga did not respond within 5000 ms."
      );
    } finally {
      void server.stop(true);
    }
  }, 15_000);
});
