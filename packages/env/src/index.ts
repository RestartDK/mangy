function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional<T extends string | undefined>(
  key: string,
  defaultValue: T
): T extends string ? string : string | undefined {
  return (process.env[key] ?? defaultValue) as T extends string
    ? string
    : string | undefined;
}

export const env = {
  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // Auth
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),

  // Server
  HOST: optional("HOST", "0.0.0.0"),
  PORT: optional("PORT", "3000"),
  CORS_ORIGIN: optional("CORS_ORIGIN", ""),

  // Worker
  WORKER_POLL_INTERVAL_MS: optional("WORKER_POLL_INTERVAL_MS", "15000"),
  TRACKING_POLL_INTERVAL_MS: optional("TRACKING_POLL_INTERVAL_MS", "900000"),

  // Browser push notifications
  VAPID_PUBLIC_KEY: optional("VAPID_PUBLIC_KEY", undefined),
  VAPID_PRIVATE_KEY: optional("VAPID_PRIVATE_KEY", undefined),
  VAPID_SUBJECT: optional("VAPID_SUBJECT", undefined),
} as const;

export type Env = typeof env;
