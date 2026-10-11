import { Effect } from "effect";

import { loadConfig } from "./config";
import { makeServer } from "./server";

const config = Effect.runSync(loadConfig);

export const app = makeServer(config);

if (import.meta.main) {
  app.listen({
    hostname: config.host,
    port: Number(config.port),
  });
}
