import { apiKey } from "@better-auth/api-key";
import { envConfig, resolveConfig } from "@mangy/env";
import { betterAuth } from "better-auth";
import type { Auth as BetterAuth, BetterAuthOptions } from "better-auth";
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

// Naming the options type keeps better-auth's inferred plugin types, and the
// zod internals they carry, out of this package's declaration emit.
type ApiKeyPlugins = [ReturnType<typeof apiKey>];
type MangyAuthOptions = BetterAuthOptions & { plugins: ApiKeyPlugins };

export type Auth = BetterAuth<MangyAuthOptions>;

export const makeAuth = (config: AuthConfig): Auth => {
  const configuredOrigins = splitOrigins(config.corsOrigin);
  const isProduction = config.nodeEnv === "production";

  const options: MangyAuthOptions = {
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
    plugins: [
      apiKey({
        defaultPrefix: "mangy_",
        enableSessionForAPIKeys: true,
        maximumNameLength: 120,
        // The plugin counts 10 requests per day by default, which would cap the
        // scripted clients this feature exists for. Nothing limited them before.
        rateLimit: { enabled: false },
        startingCharactersConfig: { charactersLength: 12 },
      }),
    ],
    secret: config.secret,
    trustedOrigins: () =>
      isProduction
        ? configuredOrigins
        : [...new Set([...configuredOrigins, ...trustedDevOrigins])],
  };

  return betterAuth(options);
};

let resolvedAuth: Auth | undefined;

export const getAuth = (): Auth => {
  resolvedAuth ??= makeAuth(resolveConfig(authConfig));
  return resolvedAuth;
};
