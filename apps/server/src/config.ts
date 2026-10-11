import { Config, ConfigProvider, Effect } from "effect";

export const appConfig = Config.all({
  corsOrigin: Config.String("CORS_ORIGIN").pipe(Config.withDefault("")),
  host: Config.String("HOST").pipe(Config.withDefault("0.0.0.0")),
  nodeEnv: Config.String("NODE_ENV").pipe(Config.withDefault("development")),
  port: Config.String("PORT").pipe(Config.withDefault("3000")),
  trackingPollIntervalMs: Config.String("TRACKING_POLL_INTERVAL_MS").pipe(
    Config.withDefault("900000")
  ),
});

export type AppConfig = Config.Success<typeof appConfig>;

const configProvider = ConfigProvider.fromEnv({
  preserveEmptyStrings: true,
});

export const loadConfig = Effect.provideService(
  appConfig,
  ConfigProvider.ConfigProvider,
  configProvider
);
