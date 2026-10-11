import { getAuth } from "@mangy/auth";
import { Effect } from "effect";
import { Elysia } from "elysia";

import type { AppConfig } from "./config";
import { loadConfig } from "./config";
import { downloads } from "./modules/downloads";
import { makeLibrary } from "./modules/library";
import { live } from "./modules/live";
import { notifications } from "./modules/notifications";
import { series } from "./modules/series";
import { settings } from "./modules/settings";
import { sources } from "./modules/sources";
import { makeServer } from "./server";

export const createApp = (config: AppConfig) =>
  new Elysia()
    .mount(getAuth().handler)
    .use(sources)
    .use(series)
    .use(makeLibrary(config.trackingPollIntervalMs))
    .use(downloads)
    .use(notifications)
    .use(settings)
    .use(live);

export type App = ReturnType<typeof createApp>;

const config = Effect.runSync(loadConfig);
const elysia = createApp(config);

export const app = makeServer(elysia, config);

if (import.meta.main) {
  app.listen({
    hostname: config.host,
    port: Number(config.port),
  });
}
