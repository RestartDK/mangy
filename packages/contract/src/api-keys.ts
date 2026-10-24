import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import { ApiKeyIdSchema } from "./ids";
import { isoDateTimeString } from "./timestamps";

export const apiKeySchema = Schema.Struct({
  createdAt: isoDateTimeString,
  id: ApiKeyIdSchema,
  lastUsedAt: Schema.OptionFromNullOr(isoDateTimeString),
  name: Schema.String,
  prefix: Schema.String,
});
export type ApiKey = typeof apiKeySchema.Type;

export const createApiKeyBody = Schema.Struct({
  name: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});
export type CreateApiKey = typeof createApiKeyBody.Type;

export const createdApiKeySchema = Schema.Struct({
  key: apiKeySchema,
  secret: Schema.String,
});
export type CreatedApiKey = typeof createdApiKeySchema.Type;

export const apiKeyParamsSchema = Schema.Struct({
  apiKeyId: ApiKeyIdSchema,
});

export const revokeApiKeyResponseSchema = Schema.Struct({
  id: ApiKeyIdSchema,
});

export const ApiKeysApi = HttpApiGroup.make("apiKeys")
  .add(
    HttpApiEndpoint.get("list", "/", {
      error: [Unauthorized],
      success: Schema.Array(apiKeySchema),
    }),
    HttpApiEndpoint.post("create", "/", {
      error: [Unauthorized, BadRequest],
      payload: createApiKeyBody,
      success: createdApiKeySchema,
    }),
    HttpApiEndpoint.delete("revoke", "/:apiKeyId", {
      error: [Unauthorized, BadRequest],
      params: apiKeyParamsSchema,
      success: revokeApiKeyResponseSchema,
    })
  )
  .prefix("/api/api-keys");
