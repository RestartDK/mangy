import { Config, ConfigProvider, Effect, Option, Redacted } from "effect";

export const configProvider = ConfigProvider.fromEnv({
  preserveEmptyStrings: true,
});

export const resolveConfig = <A>(config: Config.Config<A>): A =>
  Effect.runSync(
    Effect.provideService(config, ConfigProvider.ConfigProvider, configProvider)
  );

const required = (key: string): Config.Config<string> =>
  Config.NonEmptyString(key);

const optionalString = (key: string): Config.Config<Option.Option<string>> =>
  Config.option(Config.String(key));

const optionalValue = (
  key: string,
  defaultValue: string
): Config.Config<string> =>
  Config.String(key).pipe(Config.withDefault(defaultValue));

const optionalRedacted = (
  key: string
): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.Redacted(key));

export const envConfig = {
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  CORS_ORIGIN: optionalValue("CORS_ORIGIN", ""),
  DATABASE_URL: optionalRedacted("DATABASE_URL"),
  HOST: optionalValue("HOST", "0.0.0.0"),
  KOMGA_API_KEY: optionalString("KOMGA_API_KEY"),
  KOMGA_BASE_URL: optionalString("KOMGA_BASE_URL"),
  KOMGA_PASSWORD: optionalString("KOMGA_PASSWORD"),
  KOMGA_USERNAME: optionalString("KOMGA_USERNAME"),
  NODE_ENV: optionalValue("NODE_ENV", "development"),
  PORT: optionalValue("PORT", "3000"),
  PGDATABASE: optionalString("PGDATABASE"),
  PGHOST: optionalString("PGHOST"),
  PGPASSWORD: optionalRedacted("PGPASSWORD"),
  PGPORT: optionalString("PGPORT"),
  PGUSER: optionalString("PGUSER"),
  TRACKING_POLL_INTERVAL_MS: optionalValue(
    "TRACKING_POLL_INTERVAL_MS",
    "900000"
  ),
  VAPID_PRIVATE_KEY: optionalString("VAPID_PRIVATE_KEY"),
  VAPID_PUBLIC_KEY: optionalString("VAPID_PUBLIC_KEY"),
  VAPID_SUBJECT: optionalString("VAPID_SUBJECT"),
  WORKER_POLL_INTERVAL_MS: optionalValue("WORKER_POLL_INTERVAL_MS", "15000"),
} as const;

const resolveOptional = <A>(
  config: Config.Config<Option.Option<A>>
): A | undefined => Option.getOrUndefined(resolveConfig(config));

export const env = {
  get BETTER_AUTH_SECRET() {
    return resolveConfig(envConfig.BETTER_AUTH_SECRET);
  },
  get BETTER_AUTH_URL() {
    return resolveConfig(envConfig.BETTER_AUTH_URL);
  },
  get CORS_ORIGIN() {
    return resolveConfig(envConfig.CORS_ORIGIN);
  },
  get DATABASE_URL() {
    return resolveOptional(envConfig.DATABASE_URL);
  },
  get HOST() {
    return resolveConfig(envConfig.HOST);
  },
  get KOMGA_API_KEY() {
    return resolveOptional(envConfig.KOMGA_API_KEY);
  },
  get KOMGA_BASE_URL() {
    return resolveOptional(envConfig.KOMGA_BASE_URL);
  },
  get KOMGA_PASSWORD() {
    return resolveOptional(envConfig.KOMGA_PASSWORD);
  },
  get KOMGA_USERNAME() {
    return resolveOptional(envConfig.KOMGA_USERNAME);
  },
  get NODE_ENV() {
    return resolveConfig(envConfig.NODE_ENV);
  },
  get PORT() {
    return resolveConfig(envConfig.PORT);
  },
  get PGDATABASE() {
    return resolveOptional(envConfig.PGDATABASE);
  },
  get PGHOST() {
    return resolveOptional(envConfig.PGHOST);
  },
  get PGPASSWORD() {
    return resolveOptional(envConfig.PGPASSWORD);
  },
  get PGPORT() {
    return resolveOptional(envConfig.PGPORT);
  },
  get PGUSER() {
    return resolveOptional(envConfig.PGUSER);
  },
  get TRACKING_POLL_INTERVAL_MS() {
    return resolveConfig(envConfig.TRACKING_POLL_INTERVAL_MS);
  },
  get VAPID_PRIVATE_KEY() {
    return resolveOptional(envConfig.VAPID_PRIVATE_KEY);
  },
  get VAPID_PUBLIC_KEY() {
    return resolveOptional(envConfig.VAPID_PUBLIC_KEY);
  },
  get VAPID_SUBJECT() {
    return resolveOptional(envConfig.VAPID_SUBJECT);
  },
  get WORKER_POLL_INTERVAL_MS() {
    return resolveConfig(envConfig.WORKER_POLL_INTERVAL_MS);
  },
} as const;

export type Env = typeof env;
