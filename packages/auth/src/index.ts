import { db } from "@mangy/db";
import * as schema from "@mangy/db/schema/auth";
import { env } from "@mangy/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const configuredOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const trustedDevOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://192.168.*:3001",
  "http://10.*.*.*:3001",
  "http://172.*.*.*:3001",
  "http://*.local:3001",
];

const getTrustedOrigins = (): string[] => {
  if (process.env.NODE_ENV === "production") {
    return configuredOrigins;
  }

  return [...new Set([...configuredOrigins, ...trustedDevOrigins])];
};

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",

    schema,
  }),
  trustedOrigins: () => getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
});
