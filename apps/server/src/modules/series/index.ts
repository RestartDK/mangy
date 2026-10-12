import { Api, SeriesPageNotFound, SeriesRequestFailed } from "@mangy/contract";
import { decodeSourceChapterId, decodeSourceId } from "@mangy/db/model";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { currentUser, getSessionUser } from "@/lib/auth";

import { SeriesService, SeriesServiceError } from "./service";

const seriesMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Unable to load series data";

const seriesRequestFailed = (cause: unknown) =>
  new SeriesRequestFailed({ message: seriesMessage(cause) });

const seriesPageFailed = (cause: unknown) =>
  cause instanceof SeriesServiceError && cause.status === 404
    ? new SeriesPageNotFound({ message: seriesMessage(cause) })
    : seriesRequestFailed(cause);

const seriesErrorStatus = (cause: unknown) =>
  cause instanceof SeriesServiceError ? cause.status : 400;

// HttpServerRequest.url carries no scheme or host, so the origin the request
// arrived on has to be rebuilt from the host header before the proxy URL is
// handed back to the browser.
const requestUrl = (request: HttpServerRequest.HttpServerRequest) =>
  new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

export const SeriesApiLive = HttpApiBuilder.group(Api, "series", (handlers) =>
  handlers.handleAll({
    get: Effect.fn(function* getSeriesHandler({ params, query }) {
      yield* currentUser;
      return yield* Effect.tryPromise({
        catch: seriesRequestFailed,
        try: async () =>
          await SeriesService.getSeries(query.sourceId, params.seriesId),
      });
    }),
    getChapters: Effect.fn(function* getChaptersHandler({ params, query }) {
      yield* currentUser;
      return yield* Effect.tryPromise({
        catch: seriesRequestFailed,
        try: async () =>
          await SeriesService.getChapters(query.sourceId, params.seriesId),
      });
    }),
    getPages: Effect.fn(function* getPagesHandler({ params, query, request }) {
      yield* currentUser;
      const absoluteUrl = requestUrl(request);
      return yield* Effect.tryPromise({
        catch: seriesPageFailed,
        try: async () =>
          await SeriesService.getPages(
            query.sourceId,
            params.seriesId,
            params.chapterId,
            absoluteUrl.toString()
          ),
      });
    }),
  })
);

const seriesErrorResponse = (cause: unknown) =>
  HttpServerResponse.jsonUnsafe(
    { message: seriesMessage(cause) },
    { status: seriesErrorStatus(cause) }
  );

// Byte responses carry upstream headers (content-type, cache-control, etag,
// last-modified) that the schema-encoded HttpApi stack cannot express.
export const SeriesPageImageRoute = HttpRouter.add(
  "GET",
  "/api/series/:seriesId/chapters/:chapterId/pages/:pageIndex/image",
  Effect.gen(function* seriesPageImage() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const params = yield* HttpRouter.params;
    const webRequest = yield* HttpServerRequest.toWeb(request);
    const user = yield* Effect.promise(
      async () => await getSessionUser(webRequest)
    );

    if (!user) {
      return HttpServerResponse.jsonUnsafe(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const sourceId = requestUrl(request).searchParams.get("sourceId");
    const { chapterId } = params;
    const pageIndex = Number(params.pageIndex);

    if (
      sourceId === null ||
      chapterId === undefined ||
      !Number.isInteger(pageIndex)
    ) {
      return HttpServerResponse.jsonUnsafe(
        { message: "Unable to load series data" },
        { status: 400 }
      );
    }

    const proxied = yield* Effect.tryPromise({
      catch: seriesErrorResponse,
      try: async () =>
        await SeriesService.proxyPageImage(
          decodeSourceId(sourceId),
          decodeSourceChapterId(chapterId),
          pageIndex
        ),
    });

    return HttpServerResponse.fromWeb(proxied);
  })
);
