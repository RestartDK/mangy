import { envConfig, resolveConfig } from "@mangy/env";
import { betterAuth } from "better-auth";
import { Config } from "effect";

import { effectSqlAdapter } from "./effect-sql-adapter";

const trustedDevOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://192.168.*:3001",
  "http://10.*.*.*:3001",
  "http://100.*.*.*:3001",
  "http://172.*.*.*:3001",
  "http://*.local:3001",
];

export const authConfig = Config.all({
  baseURL: envConfig.BETTER_AUTH_URL,
  corsOrigin: envConfig.CORS_ORIGIN,
  nodeEnv: envConfig.NODE_ENV,
  secret: envConfig.BETTER_AUTH_SECRET,
});

export type AuthConfig = Config.Success<typeof authConfig>;

const splitOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const makeAuth = (config: AuthConfig) => {
  const configuredOrigins = splitOrigins(config.corsOrigin);
  const isProduction = config.nodeEnv === "production";

  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    },
    baseURL: config.baseURL,
    database: effectSqlAdapter(),
    emailAndPassword: {
      enabled: true,
    },
    secret: config.secret,
    trustedOrigins: () =>
      isProduction
        ? configuredOrigins
        : [...new Set([...configuredOrigins, ...trustedDevOrigins])],
  });
};

export type Auth = ReturnType<typeof makeAuth>;

let resolvedAuth: Auth | undefined;

export const getAuth = (): Auth => {
  resolvedAuth ??= makeAuth(resolveConfig(authConfig));
  return resolvedAuth;
};
