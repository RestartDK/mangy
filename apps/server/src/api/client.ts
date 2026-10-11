import { Layer, ManagedRuntime } from "effect";
import type { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import { Api } from "./index";

const makeRuntime = () =>
  ManagedRuntime.make(
    Layer.mergeAll(
      FetchHttpClient.layer,
      Layer.succeed(FetchHttpClient.RequestInit)({ credentials: "include" })
    )
  );

export const makeTrackingClient = (baseUrl: string) => {
  const runtime = makeRuntime();
  const clientPromise = runtime.runPromise(
    HttpApiClient.make(Api, { baseUrl })
  );
  type TrackingClient = Awaited<typeof clientPromise>;

  return {
    async run<A, E>(
      build: (client: TrackingClient) => Effect.Effect<A, E>
    ): Promise<A> {
      return await runtime.runPromise(build(await clientPromise));
    },
  };
};
