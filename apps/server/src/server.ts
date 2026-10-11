import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { getAuth } from "@mangy/auth";
import { Layer } from "effect";
import {
  HttpEffect,
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse,
} from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { Api } from "./api";
import type { AppConfig } from "./config";
import { TrackingApiLive } from "./modules/tracking";

const devOriginPatterns = [
  /^http:\/\/localhost:3001$/u,
  /^http:\/\/127\.0\.0\.1:3001$/u,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/[a-z0-9-]+\.local:3001$/iu,
];

const makeAllowedOrigin = (
  config: AppConfig
): ((origin: string) => boolean) => {
  const configuredOrigins = new Set(
    config.corsOrigin
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  return (origin: string): boolean =>
    configuredOrigins.has(origin) ||
    (config.nodeEnv !== "production" &&
      devOriginPatterns.some((pattern) => pattern.test(origin)));
};

const HealthRoute = HttpRouter.add(
  "GET",
  "/",
  HttpServerResponse.jsonUnsafe({
    appName: "Mangy",
    status: "ok",
    timestamp: Date.now(),
    version: "0.1.0",
  })
);

export const makeServer = (
  elysia: {
    handle: (request: Request) => Promise<Response>;
  },
  config: AppConfig
) => {
  const AuthRoutes = HttpRouter.add(
    "*",
    "/api/auth/*",
    HttpEffect.fromWebHandler(getAuth().handler)
  );

  const CorsMiddleware = HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: makeAllowedOrigin(config),
      credentials: true,
    }),
    { global: true }
  );

  const ElysiaFallback = HttpRouter.add(
    "*",
    "/*",
    HttpEffect.fromWebHandler(async (request) => await elysia.handle(request))
  );

  const routes = Layer.mergeAll(
    HttpApiBuilder.layer(Api).pipe(Layer.provide(TrackingApiLive)),
    AuthRoutes,
    HealthRoute,
    ElysiaFallback,
    CorsMiddleware
  );

  const { handler, dispose } = HttpRouter.toWebHandler(
    routes.pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true }
  );

  return {
    dispose,
    handle: handler,
    listen: (options: { hostname: string; port: number }) => {
      const Main = HttpRouter.serve(routes, { disableLogger: true }).pipe(
        Layer.provide(
          BunHttpServer.layer({
            hostname: options.hostname,
            port: options.port,
          })
        ),
        Layer.launch
      );

      BunRuntime.runMain(Main);
    },
  };
};
