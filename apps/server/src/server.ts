import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { auth } from "@mangy/auth";
import { env } from "@mangy/env";
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
import { TrackingApiLive } from "./modules/tracking";

const configuredOrigins = new Set(
  env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const devOriginPatterns = [
  /^http:\/\/localhost:3001$/u,
  /^http:\/\/127\.0\.0\.1:3001$/u,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/u,
  /^http:\/\/[a-z0-9-]+\.local:3001$/iu,
];

const isAllowedOrigin = (origin: string): boolean => {
  if (configuredOrigins.has(origin)) {
    return true;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    devOriginPatterns.some((pattern) => pattern.test(origin))
  );
};

const CorsMiddleware = HttpRouter.middleware(
  HttpMiddleware.cors({
    allowedOrigins: isAllowedOrigin,
    credentials: true,
  }),
  { global: true }
);

const AuthRoutes = HttpRouter.add(
  "*",
  "/api/auth/*",
  HttpEffect.fromWebHandler(auth.handler)
);

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

export const makeServer = (elysia: {
  handle: (request: Request) => Promise<Response>;
}) => {
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
