import { afterEach, describe, expect, test } from "bun:test";
import assert from "node:assert";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { column, decodeRows, insertRow, runSql, table } from "@mangy/db";
import {
  DownloadArtifact,
  Notification,
  NotificationDelivery,
  PushSubscription,
  User,
  downloadArtifactColumns,
  notificationColumns,
  notificationDeliveryColumns,
  pushSubscriptionColumns,
  sourceColumns,
  userColumns,
} from "@mangy/db/model";
import { setBrowserPushSenderForTests } from "@mangy/push";
import type {
  SourceAdapter,
  SourceChapter,
  SourcePage,
  SourceSeries,
} from "@mangy/source-sdk";
import { sourceRegistry } from "@mangy/source-sdk/registry";
import { serve } from "bun";
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql";
import { unzipSync } from "fflate";

import { setKomgaConfigForTests } from "../../worker/src/komga";
import {
  claimNextPushDelivery,
  processPushDelivery,
} from "../../worker/src/notifications";
import { processNextDownloadJob } from "../../worker/src/queue";
import {
  claimDueTrackedSeries,
  processTrackedSeries,
} from "../../worker/src/tracking";
import { app } from "../src/index";
import { SourcesStorage } from "../src/modules/sources/storage";

const pngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8lJawAAAAASUVORK5CYII=";
const sessionCookieRegex = /better-auth\.session_token=(?<token>[^;]+)/u;

const decoder = new TextDecoder();

const extractSessionCookie = (header: string | null): string | null => {
  if (header === null || header.length === 0) {
    return null;
  }

  const match = sessionCookieRegex.exec(header);
  return match?.groups?.token ?? null;
};

const deleteSource = async (sourceId: string) => {
  await runSql(
    Effect.gen(function* deleteSourceEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM ${table("source")} WHERE ${column(sourceColumns, "id")} = ${sourceId}`;
    })
  );
};

const deleteUser = async (userId: string) => {
  await runSql(
    Effect.gen(function* deleteUserEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM ${table("user")} WHERE ${column(userColumns, "id")} = ${userId}`;
    })
  );
};

const insertNotification = async (input: {
  body: string;
  title: string;
  type: string;
  userId: string;
}) => {
  await runSql(
    Effect.gen(function* insertNotificationEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`INSERT INTO ${table("notification")} ${insertRow(
        sql,
        notificationColumns,
        { id: crypto.randomUUID(), ...input }
      )}`;
    })
  );
};

const query = async <A, I>(
  schema: Schema.Codec<A, I>,
  build: (
    sql: SqlClient.SqlClient
  ) => Effect.Effect<readonly unknown[], SqlError.SqlError>
): Promise<readonly A[]> =>
  await runSql(
    Effect.gen(function* queryEffect() {
      const sql = yield* SqlClient.SqlClient;
      return yield* decodeRows(schema, yield* build(sql));
    })
  );

const createFakeAdapter = (config: {
  adapterId: string;
  chapters: SourceChapter[];
  getPages?: (chapterId: string) => Effect.Effect<{ pages: SourcePage[] }>;
  series: SourceSeries;
}) => {
  const state = {
    chapters: [...config.chapters],
    series: config.series,
  };

  const listResponse = () => ({
    hasNextPage: false,
    items: [state.series],
    page: 1,
    pageSize: 1,
    total: 1,
  });

  const adapter: SourceAdapter = {
    getChapters: (seriesId) =>
      Effect.sync(() => {
        if (seriesId !== state.series.externalId) {
          throw new Error("Unexpected series requested in fake adapter.");
        }

        return [...state.chapters];
      }),
    getFilters: () => Effect.succeed([]),
    getLatest: () => Effect.succeed(listResponse()),
    getPages: (chapterId) =>
      Effect.gen(function* getPagesEffect() {
        if (config.getPages) {
          return yield* config.getPages(chapterId);
        }

        const chapter = state.chapters.find(
          (item) => item.externalId === chapterId
        );
        if (!chapter) {
          throw new Error("Unexpected chapter requested in fake adapter.");
        }

        return {
          pages: Array.from({ length: chapter.pageCount ?? 1 }, (_, index) => ({
            imageUrl: pngDataUrl,
            index,
          })),
        };
      }),
    getPopular: () => Effect.succeed(listResponse()),
    getSeries: (seriesId) =>
      Effect.sync(() => {
        if (seriesId !== state.series.externalId) {
          throw new Error("Unexpected series requested in fake adapter.");
        }

        return state.series;
      }),
    getTrending: () => Effect.succeed(listResponse()),
    metadata: {
      capabilities: {
        supportsChapterFeed: true,
        supportsFilters: false,
        supportsLatest: true,
        supportsPageFetch: true,
        supportsPopular: true,
        supportsSearch: true,
        supportsSeriesDetails: true,
        supportsTrending: true,
      },
      description: "Deterministic test adapter",
      id: config.adapterId,
      languageCode: "en",
      name: "Test Source",
      supportedLanguages: ["en"],
      websiteUrl: "https://example.test",
    },
    searchSeries: () => Effect.succeed(listResponse()),
  };

  return {
    adapter,
    setChapters(chapters: SourceChapter[]) {
      state.chapters = [...chapters];
    },
  };
};

const createApiClient = async (
  email: string,
  password: string,
  name: string,
  options?: {
    origin?: string;
  }
) => {
  const headers = new Headers();
  const origin = options?.origin;

  const authRequest = async (path: string, body: unknown) =>
    await app.handle(
      new Request(`http://localhost${path}`, {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          ...(origin !== undefined && origin.length > 0 ? { origin } : {}),
        },
        method: "POST",
      })
    );

  const setSessionCookie = (response: Response) => {
    const cookie = extractSessionCookie(response.headers.get("set-cookie"));
    if (cookie !== null && cookie.length > 0) {
      headers.set("cookie", `better-auth.session_token=${cookie}`);
    }
  };

  const signUpResponse = await authRequest("/api/auth/sign-up/email", {
    email,
    name,
    password,
  });
  setSessionCookie(signUpResponse);

  const sessionCookie = headers.get("cookie");
  if (sessionCookie === null || sessionCookie.length === 0) {
    const signInResponse = await authRequest("/api/auth/sign-in/email", {
      email,
      password,
    });
    setSessionCookie(signInResponse);
  }

  const apiFetch = async (path: string, init?: RequestInit) => {
    const requestHeaders = new Headers(init?.headers);
    const cookie = headers.get("cookie");
    if (cookie !== null && cookie.length > 0) {
      requestHeaders.set("cookie", cookie);
    }

    return await app.handle(
      new Request(`http://localhost${path}`, {
        ...init,
        headers: {
          ...Object.fromEntries(requestHeaders.entries()),
          ...(origin !== undefined && origin.length > 0 ? { origin } : {}),
        },
      })
    );
  };

  const [createdUser] = await query(
    Schema.Struct({ id: User.fields.id }),
    (sql) =>
      sql`SELECT ${column(userColumns, "id")} FROM ${table("user")}
        WHERE ${column(userColumns, "email")} = ${email}
        LIMIT 1`
  );

  return {
    apiFetch,
    userId: createdUser?.id ?? null,
  };
};

const jsonRequest = (body: unknown, init?: RequestInit): RequestInit => ({
  ...init,
  body: JSON.stringify(body),
  headers: {
    "content-type": "application/json",
    ...Object.fromEntries(new Headers(init?.headers).entries()),
  },
});

const readJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const readUntilChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  matcher: string,
  timeoutMs = 5000
) => {
  let output = "";
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
    if (output.includes(matcher)) {
      return output;
    }
  }

  throw new Error(`Timed out waiting for chunk containing: ${matcher}`);
};

const cleanupState = {
  sourceIds: new Set<string>(),
  tempPaths: new Set<string>(),
  userIds: new Set<string>(),
};

afterEach(async () => {
  for (const sourceId of cleanupState.sourceIds) {
    await deleteSource(sourceId);
  }

  for (const userId of cleanupState.userIds) {
    await deleteUser(userId);
  }

  for (const tempPath of cleanupState.tempPaths) {
    await rm(tempPath, { force: true, recursive: true });
  }

  cleanupState.sourceIds.clear();
  cleanupState.tempPaths.clear();
  cleanupState.userIds.clear();
  setBrowserPushSenderForTests(null);
  setKomgaConfigForTests(null);
  sourceRegistry.reset();
});

describe("server and worker integration", () => {
  test("auth accepts tailscale-style dev origins", async () => {
    const email = `tailscale-reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const tailscaleOrigin = "http://100.91.192.69:3001";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Tailscale Reader",
      {
        origin: tailscaleOrigin,
      }
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const settingsBootstrapResponse = await apiFetch(
      "/api/settings/bootstrap",
      {
        method: "GET",
      }
    );
    expect(settingsBootstrapResponse.status).toBe(200);
  });

  test("queue controls, worker processing, tracking automation, and notification APIs work together", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(nodePath.join(tmpdir(), "mangy-test-"));

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    const series: SourceSeries = {
      artistNames: ["Artist"],
      authorNames: ["Author"],
      availableTranslatedLanguages: ["en"],
      canonicalUrl: `https://example.test/${seriesExternalId}`,
      contentRating: null,
      coverImageUrl: "https://example.test/cover.png",
      description: "Integration test series",
      externalId: seriesExternalId,
      latestChapter: "1",
      originalLanguage: "en",
      publicationDemographic: null,
      status: "ongoing",
      tags: ["test"],
      title: "Integration Test Series",
    };

    const chapterOne: SourceChapter = {
      chapterNumber: "1",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/1`,
      isUnavailable: false,
      pageCount: 2,
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      sourceOrder: "1",
      title: "Arrival",
      translatedLanguage: "en",
      volumeNumber: "1",
    };

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [chapterOne],
      series,
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Integration Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const destinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: tempDirectory,
          isDefault: true,
          name: "Integration Library",
        },
        { method: "POST" }
      )
    );
    expect(destinationResponse.status).toBe(200);
    const destination = await readJson<{
      id: string;
      name: string;
    }>(destinationResponse);

    const queueResponse = await apiFetch(
      "/api/downloads",
      jsonRequest(
        {
          chapterId: chapterOne.externalId,
          downloadDestinationId: destination.id,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "POST" }
      )
    );
    expect(queueResponse.status).toBe(200);
    const queuedJob = await readJson<{ id: string; status: string }>(
      queueResponse
    );
    expect(queuedJob.status).toBe("queued");

    const cancelResponse = await apiFetch(
      `/api/downloads/${queuedJob.id}/cancel`,
      {
        method: "POST",
      }
    );
    expect(cancelResponse.status).toBe(200);
    const body = await readJson<{ status: string }>(cancelResponse);
    expect(body.status).toBe("cancelled");

    const retryResponse = await apiFetch(
      `/api/downloads/${queuedJob.id}/retry`,
      {
        method: "POST",
      }
    );
    expect(retryResponse.status).toBe(200);
    const body2 = await readJson<{ status: string }>(retryResponse);
    expect(body2.status).toBe("queued");

    const claimedJob = await processNextDownloadJob("test-worker");
    expect(claimedJob?.id).toBe(queuedJob.id);
    assert.ok(claimedJob, "Expected a claimed download job.");

    const downloadsResponse = await apiFetch("/api/downloads", {
      method: "GET",
    });
    expect(downloadsResponse.status).toBe(200);
    const downloads =
      await readJson<{ id: string; status: string }[]>(downloadsResponse);
    expect(
      downloads.some(
        (job) => job.id === queuedJob.id && job.status === "completed"
      )
    ).toBe(true);

    const libraryStateResponse = await apiFetch(
      `/api/library/series-state?sourceId=${adapterId}&seriesId=${seriesExternalId}`,
      { method: "GET" }
    );
    expect(libraryStateResponse.status).toBe(200);
    const body3 = await readJson<{ downloadDestinationId: string | null }>(
      libraryStateResponse
    );
    expect(body3.downloadDestinationId).toBe(destination.id);

    const saveTrackingResponse = await apiFetch(
      "/api/library/series-state",
      jsonRequest(
        {
          autoDownload: true,
          downloadDestinationId: destination.id,
          isTracked: true,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "PATCH" }
      )
    );
    expect(saveTrackingResponse.status).toBe(200);
    const trackedState = await readJson<{
      autoDownload: boolean;
      isTracked: boolean;
      trackingState: { lastSeenChapterExternalId: string | null } | null;
    }>(saveTrackingResponse);
    expect(trackedState.autoDownload).toBe(true);
    expect(trackedState.isTracked).toBe(true);
    expect(trackedState.trackingState?.lastSeenChapterExternalId).toBe(
      chapterOne.externalId
    );

    const chapterTwo: SourceChapter = {
      ...chapterOne,
      chapterNumber: "2",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/2`,
      publishedAt: new Date("2025-01-02T00:00:00.000Z"),
      sourceOrder: "2",
      title: "Follow Up",
    };

    fakeAdapter.setChapters([chapterTwo, chapterOne]);

    const refreshResponse = await apiFetch(
      "/api/tracking/refresh",
      jsonRequest(
        {
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "POST" }
      )
    );
    expect(refreshResponse.status).toBe(200);

    const claimedTrackedSeries = await claimDueTrackedSeries();
    expect(claimedTrackedSeries?.seriesExternalId).toBe(seriesExternalId);
    assert.ok(claimedTrackedSeries, "Expected a claimed tracked series.");
    await processTrackedSeries(claimedTrackedSeries);

    const trackingResponse = await apiFetch("/api/tracking", { method: "GET" });
    expect(trackingResponse.status).toBe(200);
    const trackedSeries =
      await readJson<
        { lastSeenChapterExternalId: string | null; seriesId: string }[]
      >(trackingResponse);
    expect(
      trackedSeries.some(
        (item) =>
          item.seriesId === seriesExternalId &&
          item.lastSeenChapterExternalId === chapterTwo.externalId
      )
    ).toBe(true);

    const notificationsResponse = await apiFetch("/api/notifications", {
      method: "GET",
    });
    expect(notificationsResponse.status).toBe(200);
    const notifications = await readJson<
      { id: string; isRead: boolean; type: string }[]
    >(notificationsResponse);
    expect(
      notifications.some((item) => item.type === "downloadCompleted")
    ).toBe(true);
    expect(
      notifications.some((item) => item.type === "trackedSeriesUpdated")
    ).toBe(true);

    const [firstNotification] = notifications;
    expect(firstNotification).toBeDefined();

    const markReadResponse = await apiFetch(
      `/api/notifications/${firstNotification?.id}/read`,
      { method: "PATCH" }
    );
    expect(markReadResponse.status).toBe(200);
    const body4 = await readJson<{ isRead: boolean }>(markReadResponse);
    expect(body4.isRead).toBe(true);

    const preferencesResponse = await apiFetch(
      "/api/notifications/preferences",
      {
        method: "GET",
      }
    );
    expect(preferencesResponse.status).toBe(200);
    const body5 = await readJson<{ inAppEnabled: boolean }>(
      preferencesResponse
    );
    expect(body5.inAppEnabled).toBe(true);

    const updatePreferencesResponse = await apiFetch(
      "/api/notifications/preferences",
      jsonRequest({ inAppEnabled: false }, { method: "PATCH" })
    );
    expect(updatePreferencesResponse.status).toBe(200);
    const body6 = await readJson<{ inAppEnabled: boolean }>(
      updatePreferencesResponse
    );
    expect(body6.inAppEnabled).toBe(false);

    const markAllReadResponse = await apiFetch(
      "/api/notifications/mark-all-read",
      {
        method: "POST",
      }
    );
    expect(markAllReadResponse.status).toBe(200);
    const body7 = await readJson<{ updatedCount: number }>(markAllReadResponse);
    expect(body7.updatedCount).toBeGreaterThanOrEqual(1);

    const settingsBootstrapResponse = await apiFetch(
      "/api/settings/bootstrap",
      {
        method: "GET",
      }
    );
    expect(settingsBootstrapResponse.status).toBe(200);
    const settingsBootstrap = await readJson<{
      notifications: { inAppEnabled: boolean; unreadCount: number };
    }>(settingsBootstrapResponse);
    expect(settingsBootstrap.notifications.inAppEnabled).toBe(false);
    expect(settingsBootstrap.notifications.unreadCount).toBe(0);

    const queuedAutoDownloadResponse = await apiFetch("/api/downloads", {
      method: "GET",
    });
    const queuedAutoDownloads = await readJson<
      { chapterId: string | null; status: string }[]
    >(queuedAutoDownloadResponse);
    expect(
      queuedAutoDownloads.some(
        (job) =>
          job.chapterId === chapterTwo.externalId && job.status === "queued"
      )
    ).toBe(true);
  });

  test("worker triggers a Komga library scan after a destination download", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-komga-test-")
    );
    const komgaLibraryId = `komga-library-${crypto.randomUUID()}`;
    const komgaApiKey = `komga-key-${crypto.randomUUID()}`;
    const scanRequests: {
      apiKey: string | null;
      method: string;
      pathname: string;
    }[] = [];

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    const komgaServer = serve({
      fetch(request) {
        const url = new URL(request.url);
        scanRequests.push({
          apiKey: request.headers.get("x-api-key"),
          method: request.method,
          pathname: url.pathname,
        });

        return new Response(null, { status: 202 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    setKomgaConfigForTests({
      apiKey: komgaApiKey,
      baseUrl: `http://127.0.0.1:${komgaServer.port}`,
      password: undefined,
      username: undefined,
    });

    try {
      const series: SourceSeries = {
        artistNames: ["Artist"],
        authorNames: ["Author"],
        availableTranslatedLanguages: ["en"],
        canonicalUrl: `https://example.test/${seriesExternalId}`,
        contentRating: null,
        coverImageUrl: "https://example.test/cover.png",
        description: "Komga scan test series",
        externalId: seriesExternalId,
        latestChapter: "1",
        originalLanguage: "en",
        publicationDemographic: null,
        status: "ongoing",
        tags: ["test"],
        title: "Komga Scan Series",
      };

      const chapterOne: SourceChapter = {
        chapterNumber: "1",
        externalId: `chapter-${crypto.randomUUID()}`,
        externalUrl: `https://example.test/${seriesExternalId}/1`,
        isUnavailable: false,
        pageCount: 1,
        publishedAt: new Date("2025-01-01T00:00:00.000Z"),
        sourceOrder: "1",
        title: "Komga Arrival",
        translatedLanguage: "en",
        volumeNumber: "1",
      };

      const fakeAdapter = createFakeAdapter({
        adapterId,
        chapters: [chapterOne],
        series,
      });

      sourceRegistry.register(fakeAdapter.adapter);
      await SourcesStorage.syncSources([fakeAdapter.adapter]);

      const email = `komga-reader-${crypto.randomUUID()}@example.com`;
      const password = "reader-password-123";
      const { apiFetch, userId } = await createApiClient(
        email,
        password,
        "Komga Reader"
      );

      expect(userId).toBeString();
      cleanupState.userIds.add(userId);

      const destinationResponse = await apiFetch(
        "/api/settings/destinations",
        jsonRequest(
          {
            absolutePath: tempDirectory,
            isDefault: true,
            komgaLibraryId,
            name: "Komga Library",
          },
          { method: "POST" }
        )
      );
      expect(destinationResponse.status).toBe(200);
      const destination = await readJson<{ id: string }>(destinationResponse);

      const queueResponse = await apiFetch(
        "/api/downloads",
        jsonRequest(
          {
            chapterId: chapterOne.externalId,
            downloadDestinationId: destination.id,
            seriesId: seriesExternalId,
            sourceId: adapterId,
          },
          { method: "POST" }
        )
      );
      expect(queueResponse.status).toBe(200);
      const queuedJob = await readJson<{ id: string }>(queueResponse);

      const claimedJob = await processNextDownloadJob("komga-worker");
      expect(claimedJob?.id).toBe(queuedJob.id);
      expect(
        Option.getOrNull(claimedJob?.destinationKomgaLibraryId ?? Option.none())
      ).toBe(komgaLibraryId);
      assert.ok(claimedJob, "Expected a claimed download job.");

      expect(scanRequests).toEqual([
        {
          apiKey: komgaApiKey,
          method: "POST",
          pathname: `/api/v1/libraries/${komgaLibraryId}/scan`,
        },
      ]);

      const [artifact] = await query(
        Schema.Struct({
          imported_to_komga_at: DownloadArtifact.fields.importedToKomgaAt,
          output_path: DownloadArtifact.fields.outputPath,
          package_format: DownloadArtifact.fields.packageFormat,
        }),
        (sql) =>
          sql`SELECT ${column(downloadArtifactColumns, "importedToKomgaAt")},
              ${column(downloadArtifactColumns, "outputPath")},
              ${column(downloadArtifactColumns, "packageFormat")}
            FROM ${table("downloadArtifact")}
            WHERE ${column(downloadArtifactColumns, "downloadJobId")} = ${queuedJob.id}
            LIMIT 1`
      );

      expect(artifact?.output_path).toContain(tempDirectory);
      expect(artifact?.output_path.endsWith(".cbz")).toBe(true);
      expect(artifact?.package_format).toBe("cbz");
      expect(
        Option.getOrNull(artifact?.imported_to_komga_at ?? Option.none())
      ).toBeInstanceOf(Date);
    } finally {
      void komgaServer.stop(true);
    }
  });

  test("browser push settings and queued deliveries work together", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-push-test-")
    );
    const sentPushes: {
      endpoint: string;
      payload: { body: string; title: string; url: string };
    }[] = [];

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    setBrowserPushSenderForTests(async (subscription, payload) => {
      sentPushes.push({
        endpoint: subscription.endpoint,
        payload: {
          body: payload.body,
          title: payload.title,
          url: payload.url,
        },
      });
    });

    const series: SourceSeries = {
      artistNames: ["Artist"],
      authorNames: ["Author"],
      availableTranslatedLanguages: ["en"],
      canonicalUrl: `https://example.test/${seriesExternalId}`,
      contentRating: null,
      coverImageUrl: "https://example.test/cover.png",
      description: "Push delivery test series",
      externalId: seriesExternalId,
      latestChapter: "1",
      originalLanguage: "en",
      publicationDemographic: null,
      status: "ongoing",
      tags: ["test"],
      title: "Push Delivery Series",
    };

    const chapterOne: SourceChapter = {
      chapterNumber: "1",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/1`,
      isUnavailable: false,
      pageCount: 1,
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      sourceOrder: "1",
      title: "Push Arrival",
      translatedLanguage: "en",
      volumeNumber: "1",
    };

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [chapterOne],
      series,
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `push-reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Push Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const pushSettingsResponse = await apiFetch("/api/settings/push", {
      method: "GET",
    });
    expect(pushSettingsResponse.status).toBe(200);
    const body8 = await readJson<{
      activeSubscriptionCount: number;
      isEnabled: boolean;
    }>(pushSettingsResponse);
    expect(body8.activeSubscriptionCount).toBe(0);

    const subscriptionEndpoint = `https://push.example/${crypto.randomUUID()}`;
    const subscribeResponse = await apiFetch(
      "/api/settings/push/subscriptions",
      jsonRequest(
        {
          endpoint: subscriptionEndpoint,
          expirationTime: null,
          keys: {
            auth: `auth-${crypto.randomUUID()}`,
            p256dh: `p256dh-${crypto.randomUUID()}`,
          },
          userAgent: "integration-test-browser",
        },
        { method: "POST" }
      )
    );
    expect(subscribeResponse.status).toBe(200);
    const body9 = await readJson<{
      activeSubscriptionCount: number;
      isEnabled: boolean;
    }>(subscribeResponse);
    expect(body9.activeSubscriptionCount).toBe(1);

    const updatePushPreferencesResponse = await apiFetch(
      "/api/settings/push/preferences",
      jsonRequest(
        {
          isEnabled: true,
          notifyOnDownloadCompleted: true,
          notifyOnDownloadFailed: true,
          notifyOnSystemWarning: true,
          notifyOnTrackedSeriesUpdate: false,
        },
        { method: "PATCH" }
      )
    );
    expect(updatePushPreferencesResponse.status).toBe(200);
    const body10 = await readJson<{ notifyOnTrackedSeriesUpdate: boolean }>(
      updatePushPreferencesResponse
    );
    expect(body10.notifyOnTrackedSeriesUpdate).toBe(false);

    const sendTestResponse = await apiFetch("/api/settings/push/test", {
      method: "POST",
    });
    expect(sendTestResponse.status).toBe(200);
    const body11 = await readJson<{ deliveredCount: number }>(sendTestResponse);
    expect(body11.deliveredCount).toBe(1);
    expect(sentPushes).toHaveLength(1);
    expect(sentPushes[0]?.payload.title).toBe("Browser notifications ready");

    const destinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: tempDirectory,
          isDefault: true,
          name: "Push Library",
        },
        { method: "POST" }
      )
    );
    expect(destinationResponse.status).toBe(200);
    const destination = await readJson<{ id: string }>(destinationResponse);

    const queueResponse = await apiFetch(
      "/api/downloads",
      jsonRequest(
        {
          chapterId: chapterOne.externalId,
          downloadDestinationId: destination.id,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "POST" }
      )
    );
    expect(queueResponse.status).toBe(200);
    const queuedJob = await readJson<{ id: string }>(queueResponse);

    const claimedJob = await processNextDownloadJob("push-worker");
    expect(claimedJob?.id).toBe(queuedJob.id);
    assert.ok(claimedJob, "Expected a claimed download job.");

    const queuedDeliveries = await query(
      Schema.Struct({
        id: NotificationDelivery.fields.id,
        status: NotificationDelivery.fields.status,
      }),
      (sql) =>
        sql`SELECT ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "id")},
            ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "status")}
          FROM ${table("notificationDelivery")}
          INNER JOIN ${table("notification")} ON ${table("notificationDelivery")}.${column(notificationDeliveryColumns, "notificationId")} = ${table("notification")}.${column(notificationColumns, "id")}
          WHERE ${table("notification")}.${column(notificationColumns, "userId")} = ${userId}`
    );

    expect(queuedDeliveries).toHaveLength(1);
    expect(queuedDeliveries[0]?.status).toBe("queued");

    const claimedPushDelivery = await claimNextPushDelivery("push-worker");
    expect(claimedPushDelivery?.notificationType).toBe("downloadCompleted");
    assert.ok(claimedPushDelivery, "Expected a claimed push delivery.");
    await processPushDelivery(claimedPushDelivery);

    expect(sentPushes).toHaveLength(2);
    expect(sentPushes[1]?.endpoint).toBe(subscriptionEndpoint);
    expect(sentPushes[1]?.payload.title).toBe(series.title);
    expect(sentPushes[1]?.payload.body).toContain("finished");

    const savedSubscriptions = await query(
      Schema.Struct({
        endpoint: PushSubscription.fields.endpoint,
        is_active: PushSubscription.fields.isActive,
      }),
      (sql) =>
        sql`SELECT ${column(pushSubscriptionColumns, "endpoint")},
            ${column(pushSubscriptionColumns, "isActive")}
          FROM ${table("pushSubscription")}
          WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}`
    );
    expect(savedSubscriptions).toHaveLength(1);
    expect(savedSubscriptions[0]?.is_active).toBe(true);

    const unsubscribeResponse = await apiFetch(
      "/api/settings/push/subscriptions/remove",
      jsonRequest(
        {
          endpoint: subscriptionEndpoint,
        },
        { method: "POST" }
      )
    );
    expect(unsubscribeResponse.status).toBe(200);
    const unsubscribeSettings = await readJson<{
      activeSubscriptionCount: number;
      isEnabled: boolean;
    }>(unsubscribeResponse);
    expect(unsubscribeSettings.activeSubscriptionCount).toBe(0);
    expect(unsubscribeSettings.isEnabled).toBe(false);

    const inactiveSubscriptions = await query(
      Schema.Struct({ is_active: PushSubscription.fields.isActive }),
      (sql) =>
        sql`SELECT ${column(pushSubscriptionColumns, "isActive")} FROM ${table("pushSubscription")}
          WHERE ${column(pushSubscriptionColumns, "userId")} = ${userId}`
    );
    expect(inactiveSubscriptions[0]?.is_active).toBe(false);
  });

  test("destinations can be removed and tracked auto-download is turned off safely", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const primaryDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-delete-a-")
    );
    const fallbackDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-delete-b-")
    );

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(primaryDirectory);
    cleanupState.tempPaths.add(fallbackDirectory);

    const series: SourceSeries = {
      artistNames: ["Artist"],
      authorNames: ["Author"],
      availableTranslatedLanguages: ["en"],
      canonicalUrl: `https://example.test/${seriesExternalId}`,
      contentRating: null,
      coverImageUrl: "https://example.test/cover.png",
      description: "Destination deletion series",
      externalId: seriesExternalId,
      latestChapter: "1",
      originalLanguage: "en",
      publicationDemographic: null,
      status: "ongoing",
      tags: ["test"],
      title: "Delete Destination Series",
    };

    const chapterOne: SourceChapter = {
      chapterNumber: "1",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/1`,
      isUnavailable: false,
      pageCount: 1,
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      sourceOrder: "1",
      title: "Chapter One",
      translatedLanguage: "en",
      volumeNumber: "1",
    };

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [chapterOne],
      series,
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Destination Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const primaryDestinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: primaryDirectory,
          isDefault: true,
          name: "Primary Library",
        },
        { method: "POST" }
      )
    );
    expect(primaryDestinationResponse.status).toBe(200);
    const primaryDestination = await readJson<{ id: string }>(
      primaryDestinationResponse
    );

    const fallbackDestinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: fallbackDirectory,
          name: "Fallback Library",
        },
        { method: "POST" }
      )
    );
    expect(fallbackDestinationResponse.status).toBe(200);
    const fallbackDestination = await readJson<{ id: string }>(
      fallbackDestinationResponse
    );

    const saveTrackingResponse = await apiFetch(
      "/api/library/series-state",
      jsonRequest(
        {
          autoDownload: true,
          downloadDestinationId: primaryDestination.id,
          isTracked: true,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "PATCH" }
      )
    );
    expect(saveTrackingResponse.status).toBe(200);

    const deleteResponse = await apiFetch(
      `/api/settings/destinations/${primaryDestination.id}`,
      { method: "DELETE" }
    );
    expect(deleteResponse.status).toBe(200);
    const body12 = await readJson<{ id: string }>(deleteResponse);
    expect(body12.id).toBe(primaryDestination.id);

    const settingsBootstrapResponse = await apiFetch(
      "/api/settings/bootstrap",
      {
        method: "GET",
      }
    );
    expect(settingsBootstrapResponse.status).toBe(200);
    const settingsBootstrap = await readJson<{
      destinations: { id: string; isDefault: boolean }[];
    }>(settingsBootstrapResponse);
    expect(settingsBootstrap.destinations).toHaveLength(1);
    expect(settingsBootstrap.destinations[0]?.id).toBe(fallbackDestination.id);
    expect(settingsBootstrap.destinations[0]?.isDefault).toBe(true);

    const libraryStateResponse = await apiFetch(
      `/api/library/series-state?sourceId=${adapterId}&seriesId=${seriesExternalId}`,
      { method: "GET" }
    );
    expect(libraryStateResponse.status).toBe(200);
    const libraryState = await readJson<{
      autoDownload: boolean;
      downloadDestinationId: string | null;
      isTracked: boolean;
    }>(libraryStateResponse);
    expect(libraryState.isTracked).toBe(true);
    expect(libraryState.autoDownload).toBe(false);
    expect(libraryState.downloadDestinationId).toBeNull();
  });

  test("destinations with queued downloads cannot be removed", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-delete-job-")
    );

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    const series: SourceSeries = {
      artistNames: ["Artist"],
      authorNames: ["Author"],
      availableTranslatedLanguages: ["en"],
      canonicalUrl: `https://example.test/${seriesExternalId}`,
      contentRating: null,
      coverImageUrl: "https://example.test/cover.png",
      description: "Queued deletion guard series",
      externalId: seriesExternalId,
      latestChapter: "1",
      originalLanguage: "en",
      publicationDemographic: null,
      status: "ongoing",
      tags: ["test"],
      title: "Queued Guard Series",
    };

    const chapterOne: SourceChapter = {
      chapterNumber: "1",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/1`,
      isUnavailable: false,
      pageCount: 1,
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      sourceOrder: "1",
      title: "Queued Chapter",
      translatedLanguage: "en",
      volumeNumber: "1",
    };

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [chapterOne],
      series,
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Queued Guard Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const destinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: tempDirectory,
          isDefault: true,
          name: "Busy Library",
        },
        { method: "POST" }
      )
    );
    expect(destinationResponse.status).toBe(200);
    const destination = await readJson<{ id: string }>(destinationResponse);

    const queueResponse = await apiFetch(
      "/api/downloads",
      jsonRequest(
        {
          chapterId: chapterOne.externalId,
          downloadDestinationId: destination.id,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "POST" }
      )
    );
    expect(queueResponse.status).toBe(200);

    const deleteResponse = await apiFetch(
      `/api/settings/destinations/${destination.id}`,
      { method: "DELETE" }
    );
    expect(deleteResponse.status).toBe(400);
    const body13 = await readJson<{ message: string }>(deleteResponse);
    expect(body13.message).toBe(
      "This destination is still used by queued or running downloads. Cancel or finish those jobs first."
    );
  });

  test("library series can be removed and tracking state is cleared", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-library-remove-")
    );

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    const series: SourceSeries = {
      artistNames: ["Artist"],
      authorNames: ["Author"],
      availableTranslatedLanguages: ["en"],
      canonicalUrl: `https://example.test/${seriesExternalId}`,
      contentRating: null,
      coverImageUrl: "https://example.test/cover.png",
      description: "Library removal series",
      externalId: seriesExternalId,
      latestChapter: "1",
      originalLanguage: "en",
      publicationDemographic: null,
      status: "ongoing",
      tags: ["test"],
      title: "Library Removal Series",
    };

    const chapterOne: SourceChapter = {
      chapterNumber: "1",
      externalId: `chapter-${crypto.randomUUID()}`,
      externalUrl: `https://example.test/${seriesExternalId}/1`,
      isUnavailable: false,
      pageCount: 1,
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      sourceOrder: "1",
      title: "Chapter One",
      translatedLanguage: "en",
      volumeNumber: "1",
    };

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [chapterOne],
      series,
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `reader-${crypto.randomUUID()}@example.com`;
    const password = "reader-password-123";
    const { apiFetch, userId } = await createApiClient(
      email,
      password,
      "Library Removal Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const destinationResponse = await apiFetch(
      "/api/settings/destinations",
      jsonRequest(
        {
          absolutePath: tempDirectory,
          isDefault: true,
          name: "Library Removal Destination",
        },
        { method: "POST" }
      )
    );
    expect(destinationResponse.status).toBe(200);
    const destination = await readJson<{ id: string }>(destinationResponse);

    const saveTrackingResponse = await apiFetch(
      "/api/library/series-state",
      jsonRequest(
        {
          autoDownload: true,
          downloadDestinationId: destination.id,
          isTracked: true,
          seriesId: seriesExternalId,
          sourceId: adapterId,
        },
        { method: "PATCH" }
      )
    );
    expect(saveTrackingResponse.status).toBe(200);
    const savedTrackingState = await readJson<{
      libraryEntryId: string | null;
    }>(saveTrackingResponse);

    const populatedLibraryResponse = await apiFetch("/api/library", {
      method: "GET",
    });
    expect({
      entries: await readJson<
        {
          autoDownload: boolean;
          coverImageUrl: string | null;
          destinationName: string | null;
          id: string;
          isTracked: boolean;
          seriesId: string;
          sourceId: string;
          title: string;
          updatedAt: string;
        }[]
      >(populatedLibraryResponse).catch(() => null),
      status: populatedLibraryResponse.status,
    }).toMatchObject({
      entries: [
        {
          autoDownload: true,
          coverImageUrl: "https://example.test/cover.png",
          destinationName: "Library Removal Destination",
          id: savedTrackingState.libraryEntryId,
          isTracked: true,
          seriesId: seriesExternalId,
          sourceId: adapterId,
          title: "Library Removal Series",
        },
      ],
      status: 200,
    });

    const removeResponse = await apiFetch(
      `/api/library/series-state?sourceId=${adapterId}&seriesId=${seriesExternalId}`,
      { method: "DELETE" }
    );
    expect(removeResponse.status).toBe(200);
    const body14 = await readJson<{ sourceId: string; seriesId: string }>(
      removeResponse
    );
    expect(body14.seriesId).toBe(seriesExternalId);

    const libraryResponse = await apiFetch("/api/library", {
      method: "GET",
    });
    expect(libraryResponse.status).toBe(200);
    expect(
      await readJson<{ seriesId: string }[]>(libraryResponse)
    ).toHaveLength(0);

    const trackingResponse = await apiFetch("/api/tracking", {
      method: "GET",
    });
    expect(trackingResponse.status).toBe(200);
    expect(
      await readJson<{ seriesId: string }[]>(trackingResponse)
    ).toHaveLength(0);

    const seriesStateResponse = await apiFetch(
      `/api/library/series-state?sourceId=${adapterId}&seriesId=${seriesExternalId}`,
      { method: "GET" }
    );
    expect(seriesStateResponse.status).toBe(200);
    expect(
      await readJson<{
        autoDownload: boolean;
        downloadDestinationName: string | null;
        downloadDestinationId: string | null;
        isTracked: boolean;
        libraryEntryId: string | null;
        seriesId: string;
        sourceId: string;
        trackingState: null;
      }>(seriesStateResponse)
    ).toEqual({
      autoDownload: false,
      downloadDestinationId: null,
      downloadDestinationName: null,
      isTracked: false,
      libraryEntryId: null,
      seriesId: seriesExternalId,
      sourceId: adapterId,
      trackingState: null,
    });
  });

  test("page endpoints and worker downloads honor page headers and referer metadata", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;
    const tempDirectory = await mkdtemp(
      nodePath.join(tmpdir(), "mangy-pages-test-")
    );
    const requiredReferer = "https://reader.example/chapter";
    const requiredToken = `token-${crypto.randomUUID()}`;
    const imageRequests: {
      referer: string | null;
      token: string | null;
    }[] = [];
    const pngBytes = Buffer.from(pngDataUrl.split(",")[1] ?? "", "base64");

    cleanupState.sourceIds.add(adapterId);
    cleanupState.tempPaths.add(tempDirectory);

    const imageServer = serve({
      fetch(request) {
        imageRequests.push({
          referer: request.headers.get("referer"),
          token: request.headers.get("x-test-token"),
        });

        if (
          request.headers.get("referer") !== requiredReferer ||
          request.headers.get("x-test-token") !== requiredToken
        ) {
          return new Response("Forbidden", { status: 403 });
        }

        return new Response(pngBytes, {
          headers: {
            "content-type": "image/png",
          },
          status: 200,
        });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      const series: SourceSeries = {
        artistNames: ["Artist"],
        authorNames: ["Author"],
        availableTranslatedLanguages: ["en"],
        canonicalUrl: `https://example.test/${seriesExternalId}`,
        contentRating: null,
        coverImageUrl: "https://example.test/cover.png",
        description: "Header-gated pages series",
        externalId: seriesExternalId,
        latestChapter: "1",
        originalLanguage: "en",
        publicationDemographic: null,
        status: "ongoing",
        tags: ["test"],
        title: "Header Gated Series",
      };

      const chapterOne: SourceChapter = {
        chapterNumber: "1",
        externalId: `chapter-${crypto.randomUUID()}`,
        externalUrl: `https://example.test/${seriesExternalId}/1`,
        isUnavailable: false,
        pageCount: 1,
        publishedAt: new Date("2025-01-01T00:00:00.000Z"),
        sourceOrder: "1",
        title: "Access Check",
        translatedLanguage: "en",
        volumeNumber: "1",
      };

      const fakeAdapter = createFakeAdapter({
        adapterId,
        chapters: [chapterOne],
        getPages(chapterId) {
          if (chapterId !== chapterOne.externalId) {
            throw new Error("Unexpected chapter requested in fake adapter.");
          }

          return Effect.succeed({
            pages: [
              {
                headers: {
                  "x-test-token": requiredToken,
                },
                imageUrl: `http://127.0.0.1:${imageServer.port}/page.png`,
                index: 0,
                referer: requiredReferer,
              },
            ],
          });
        },
        series,
      });

      sourceRegistry.register(fakeAdapter.adapter);
      await SourcesStorage.syncSources([fakeAdapter.adapter]);

      const email = `reader-${crypto.randomUUID()}@example.com`;
      const password = "reader-password-123";
      const { apiFetch, userId } = await createApiClient(
        email,
        password,
        "Metadata Reader"
      );

      expect(userId).toBeString();
      cleanupState.userIds.add(userId);

      const destinationResponse = await apiFetch(
        "/api/settings/destinations",
        jsonRequest(
          {
            absolutePath: tempDirectory,
            isDefault: true,
            name: "Metadata Library",
          },
          { method: "POST" }
        )
      );
      expect(destinationResponse.status).toBe(200);
      const destination = await readJson<{ id: string }>(destinationResponse);

      const pagesResponse = await apiFetch(
        `/api/series/${seriesExternalId}/chapters/${chapterOne.externalId}/pages?sourceId=${adapterId}`,
        { method: "GET" }
      );
      expect(pagesResponse.status).toBe(200);
      const pageList = await readJson<{
        pages: { imageUrl: string; index: number }[];
      }>(pagesResponse);
      expect(pageList.pages).toHaveLength(1);
      expect(pageList.pages[0]?.index).toBe(0);

      const proxiedImageUrl = new URL(pageList.pages[0]?.imageUrl ?? "");
      const proxiedImageResponse = await apiFetch(
        `${proxiedImageUrl.pathname}${proxiedImageUrl.search}`,
        { method: "GET" }
      );
      expect(proxiedImageResponse.status).toBe(200);
      expect(proxiedImageResponse.headers.get("content-type")).toContain(
        "image/png"
      );
      const buffer = await proxiedImageResponse.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);

      const queueResponse = await apiFetch(
        "/api/downloads",
        jsonRequest(
          {
            chapterId: chapterOne.externalId,
            downloadDestinationId: destination.id,
            seriesId: seriesExternalId,
            sourceId: adapterId,
          },
          { method: "POST" }
        )
      );
      expect(queueResponse.status).toBe(200);
      const queuedJob = await readJson<{ id: string }>(queueResponse);

      const claimedJob = await processNextDownloadJob("metadata-worker");
      expect(claimedJob?.id).toBe(queuedJob.id);
      assert.ok(claimedJob, "Expected a claimed download job.");

      const entries = await readdir(tempDirectory, { recursive: true });
      const downloadedFiles = entries.filter((entry) => entry.endsWith(".cbz"));
      expect(downloadedFiles).toHaveLength(1);

      const [downloadedFile] = downloadedFiles;
      expect(downloadedFile).toBeString();
      if (!downloadedFile) {
        throw new Error("Expected the worker to write a CBZ file.");
      }

      const archiveBytes = await readFile(
        nodePath.join(tempDirectory, downloadedFile)
      );
      const archiveFiles = unzipSync(new Uint8Array(archiveBytes));
      expect(Object.keys(archiveFiles)).toEqual(["001.png"]);
      expect(imageRequests.length).toBe(2);
      expect(
        imageRequests.every(
          (request) =>
            request.referer === requiredReferer &&
            request.token === requiredToken
        )
      ).toBe(true);
    } finally {
      void imageServer.stop(true);
    }
  });

  test("live SSE endpoint emits update events when notification state changes", async () => {
    const adapterId = `test-source-${crypto.randomUUID()}`;
    const seriesExternalId = `series-${crypto.randomUUID()}`;

    cleanupState.sourceIds.add(adapterId);

    const fakeAdapter = createFakeAdapter({
      adapterId,
      chapters: [],
      series: {
        artistNames: [],
        authorNames: [],
        availableTranslatedLanguages: ["en"],
        canonicalUrl: `https://example.test/${seriesExternalId}`,
        contentRating: null,
        coverImageUrl: null,
        description: "SSE test series",
        externalId: seriesExternalId,
        latestChapter: null,
        originalLanguage: "en",
        publicationDemographic: null,
        status: "ongoing",
        tags: [],
        title: "SSE Test Series",
      },
    });

    sourceRegistry.register(fakeAdapter.adapter);
    await SourcesStorage.syncSources([fakeAdapter.adapter]);

    const email = `reader-${crypto.randomUUID()}@example.com`;
    const { apiFetch, userId } = await createApiClient(
      email,
      "reader-password-123",
      "SSE Reader"
    );

    expect(userId).toBeString();
    cleanupState.userIds.add(userId);

    const abortController = new AbortController();
    const liveResponse = await apiFetch("/api/live/events", {
      method: "GET",
      signal: abortController.signal,
    });

    expect(liveResponse.status).toBe(200);
    expect(liveResponse.headers.get("content-type")).toContain(
      "text/event-stream"
    );

    const reader = liveResponse.body?.getReader();
    expect(reader).toBeDefined();

    if (!reader) {
      throw new Error("The live endpoint did not return a stream body.");
    }

    const connectedChunk = await readUntilChunk(reader, "event: connected");
    expect(connectedChunk).toContain("event: connected");

    await insertNotification({
      body: "SSE notification body",
      title: "SSE notification",
      type: "systemWarning",
      userId,
    });

    const stateChunk = await readUntilChunk(reader, "event: state");
    expect(stateChunk).toContain('"notificationsChanged":true');

    abortController.abort();

    const [storedNotification] = await query(
      Schema.Struct({ id: Notification.fields.id }),
      (sql) =>
        sql`SELECT ${column(notificationColumns, "id")} FROM ${table("notification")}
          WHERE ${column(notificationColumns, "userId")} = ${userId}
            AND ${column(notificationColumns, "title")} = ${"SSE notification"}
          LIMIT 1`
    );

    expect(storedNotification?.id).toBeString();
  });
});
