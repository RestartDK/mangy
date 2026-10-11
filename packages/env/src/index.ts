const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optionalString = (key: string): string | undefined => process.env[key];

const optionalValue = (key: string, defaultValue: string): string =>
  process.env[key] ?? defaultValue;

export const env = {
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  CORS_ORIGIN: optionalValue("CORS_ORIGIN", ""),
  DATABASE_URL: required("DATABASE_URL"),
  HOST: optionalValue("HOST", "0.0.0.0"),
  KOMGA_API_KEY: optionalString("KOMGA_API_KEY"),
  KOMGA_BASE_URL: optionalString("KOMGA_BASE_URL"),
  KOMGA_PASSWORD: optionalString("KOMGA_PASSWORD"),
  KOMGA_USERNAME: optionalString("KOMGA_USERNAME"),
  PORT: optionalValue("PORT", "3000"),
  TRACKING_POLL_INTERVAL_MS: optionalValue(
    "TRACKING_POLL_INTERVAL_MS",
    "900000"
  ),
  VAPID_PRIVATE_KEY: optionalString("VAPID_PRIVATE_KEY"),
  VAPID_PUBLIC_KEY: optionalString("VAPID_PUBLIC_KEY"),
  VAPID_SUBJECT: optionalString("VAPID_SUBJECT"),
  WORKER_POLL_INTERVAL_MS: optionalValue("WORKER_POLL_INTERVAL_MS", "15000"),
} as const;

export type Env = typeof env;
