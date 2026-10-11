import { auth } from "@mangy/auth";
import { env } from "@mangy/env";
import { Elysia } from "elysia";

import { downloads } from "./modules/downloads";
import { library } from "./modules/library";
import { live } from "./modules/live";
import { notifications } from "./modules/notifications";
import { series } from "./modules/series";
import { settings } from "./modules/settings";
import { sources } from "./modules/sources";
import { makeServer } from "./server";

export const createApp = () =>
  new Elysia()
    .mount(auth.handler)
    .use(sources)
    .use(series)
    .use(library)
    .use(downloads)
    .use(notifications)
    .use(settings)
    .use(live);

const elysia = createApp();

export const app = makeServer(elysia);

export type App = typeof elysia;

if (import.meta.main) {
  app.listen({
    hostname: env.HOST,
    port: Number(env.PORT),
  });
}
