import { configProvider, envConfig } from "@mangy/env";
import { Config, ConfigProvider, Effect } from "effect";

export const appConfig = Config.all({
  corsOrigin: envConfig.CORS_ORIGIN,
  host: envConfig.HOST,
  nodeEnv: envConfig.NODE_ENV,
  port: envConfig.PORT,
  trackingPollIntervalMs: envConfig.TRACKING_POLL_INTERVAL_MS,
});

export type AppConfig = Config.Success<typeof appConfig>;

export const loadConfig = Effect.provideService(
  appConfig,
  ConfigProvider.ConfigProvider,
  configProvider
);
