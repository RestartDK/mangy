import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { ApiKey, CreatedApiKey } from "@mangy/contract";

export const apiKeysQuery = ApiAtoms.query("apiKeys", "list", {
  reactivityKeys: [reactivityKey.apiKeys],
});

export const createApiKey = ApiAtoms.mutation("apiKeys", "create");

export const revokeApiKey = ApiAtoms.mutation("apiKeys", "revoke");
