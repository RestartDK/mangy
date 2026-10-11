import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

export const apiHttpClient = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit)({ credentials: "include" })
);
