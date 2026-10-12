import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

export const apiCredentials = Layer.succeed(FetchHttpClient.RequestInit)({
  credentials: "include",
});

export const apiHttpClient = Layer.mergeAll(
  FetchHttpClient.layer,
  apiCredentials
);
