import { Config, ConfigProvider, Effect, Option } from "effect";

const provider = ConfigProvider.fromEnv({ preserveEmptyStrings: true });

const load = <A>(config: Config.Config<A>): A =>
  Effect.runSync(
    Effect.provideService(config, ConfigProvider.ConfigProvider, provider)
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

const values = {
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  CORS_ORIGIN: optionalValue("CORS_ORIGIN", ""),
  DATABASE_URL: required("DATABASE_URL"),
  HOST: optionalValue("HOST", "0.0.0.0"),
  KOMGA_API_KEY: optionalString("KOMGA_API_KEY"),
  KOMGA_BASE_URL: optionalString("KOMGA_BASE_URL"),
  KOMGA_PASSWORD: optionalString("KOMGA_PASSWORD"),
  KOMGA_USERNAME: optionalString("KOMGA_USERNAME"),
  NODE_ENV: optionalValue("NODE_ENV", "development"),
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

const resolveOptional = (config: Config.Config<Option.Option<string>>) =>
  Option.getOrUndefined(load(config));

export const env = {
  BETTER_AUTH_SECRET: load(values.BETTER_AUTH_SECRET),
  BETTER_AUTH_URL: load(values.BETTER_AUTH_URL),
  CORS_ORIGIN: load(values.CORS_ORIGIN),
  DATABASE_URL: load(values.DATABASE_URL),
  HOST: load(values.HOST),
  KOMGA_API_KEY: resolveOptional(values.KOMGA_API_KEY),
  KOMGA_BASE_URL: resolveOptional(values.KOMGA_BASE_URL),
  KOMGA_PASSWORD: resolveOptional(values.KOMGA_PASSWORD),
  KOMGA_USERNAME: resolveOptional(values.KOMGA_USERNAME),
  NODE_ENV: load(values.NODE_ENV),
  PORT: load(values.PORT),
  TRACKING_POLL_INTERVAL_MS: load(values.TRACKING_POLL_INTERVAL_MS),
  VAPID_PRIVATE_KEY: resolveOptional(values.VAPID_PRIVATE_KEY),
  VAPID_PUBLIC_KEY: resolveOptional(values.VAPID_PUBLIC_KEY),
  VAPID_SUBJECT: resolveOptional(values.VAPID_SUBJECT),
  WORKER_POLL_INTERVAL_MS: load(values.WORKER_POLL_INTERVAL_MS),
} as const;

export type Env = typeof env;
