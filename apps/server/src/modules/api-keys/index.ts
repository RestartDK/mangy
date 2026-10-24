import { getAuth } from "@mangy/auth";
import type { Auth } from "@mangy/auth";
import { Api, BadRequest, CurrentUser } from "@mangy/contract";
import type { ApiKey } from "@mangy/contract";
import { decodeApiKeyId } from "@mangy/db/model";
import { Effect, Option } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

type ApiKeyRow = Pick<
  Awaited<ReturnType<Auth["api"]["createApiKey"]>>,
  "createdAt" | "id" | "lastRequest" | "name" | "start"
>;

const toIsoString = (value: Date | null): Option.Option<string> =>
  value === null ? Option.none() : Option.some(value.toISOString());

const toApiKey = (row: ApiKeyRow): ApiKey => ({
  createdAt: row.createdAt.toISOString(),
  id: decodeApiKeyId(row.id),
  lastUsedAt: toIsoString(row.lastRequest),
  name: row.name ?? "",
  prefix: row.start ?? "",
});

const badRequest = (message: string) => (cause: unknown) =>
  new BadRequest({
    message: cause instanceof Error ? cause.message : message,
  });

const requestHeaders = HttpServerRequest.HttpServerRequest.pipe(
  Effect.map((request) => new Headers(request.headers))
);

export const ApiKeysApiLive = HttpApiBuilder.group(Api, "apiKeys", (handlers) =>
  handlers.handleAll({
    create: Effect.fn(function* createApiKeyHandler({ payload }) {
      yield* CurrentUser;
      const headers = yield* requestHeaders;
      const created = yield* Effect.tryPromise({
        catch: badRequest("Unable to create this API key"),
        try: async () =>
          await getAuth().api.createApiKey({
            body: { name: payload.name },
            headers,
          }),
      });

      return { key: toApiKey(created), secret: created.key };
    }),
    list: Effect.fn(function* listApiKeysHandler() {
      yield* CurrentUser;
      const headers = yield* requestHeaders;

      return yield* Effect.promise(
        async () =>
          await getAuth().api.listApiKeys({
            headers,
            query: { sortBy: "createdAt", sortDirection: "desc" },
          })
      ).pipe(Effect.map((listed) => listed.apiKeys.map(toApiKey)));
    }),
    revoke: Effect.fn(function* revokeApiKeyHandler({ params }) {
      yield* CurrentUser;
      const headers = yield* requestHeaders;
      yield* Effect.tryPromise({
        catch: badRequest("Unable to revoke this API key"),
        try: async () =>
          await getAuth().api.deleteApiKey({
            body: { keyId: params.apiKeyId },
            headers,
          }),
      });

      return { id: params.apiKeyId };
    }),
  })
);
