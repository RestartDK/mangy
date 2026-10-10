import { cors } from "@elysiajs/cors";
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
import { tracking } from "./modules/tracking";

const configuredOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const trustedDevOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3001$/,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/,
  /^http:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/,
  /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/,
  /^http:\/\/[a-z0-9-]+\.local:3001$/i,
] as const;

const corsOrigins =
  process.env.NODE_ENV === "production"
    ? configuredOrigins
    : [...configuredOrigins, ...trustedDevOrigins];

export const createApp = () =>
  new Elysia()
    .use(
      cors({
        origin: corsOrigins,
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      })
    )
    .mount(auth.handler)
    .get("/", () => ({
      appName: "Mangy",
      status: "ok",
      timestamp: Date.now(),
      version: "0.1.0",
    }))
    .use(sources)
    .use(series)
    .use(library)
    .use(downloads)
    .use(tracking)
    .use(notifications)
    .use(settings)
    .use(live);

export const app = createApp();

if (import.meta.main) {
  app.listen({
    hostname: env.HOST,
    port: Number(env.PORT),
  });
}

export type App = typeof app;
