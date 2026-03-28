import { env } from "@mangy/env/client";

const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);

const resolveConfiguredOrigin = (): URL | null => {
  try {
    if (typeof window === "undefined") {
      return new URL(env.VITE_SERVER_URL);
    }

    return new URL(env.VITE_SERVER_URL, window.location.origin);
  } catch {
    return null;
  }
};

export const getServerOrigin = (): string => {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }

  const configuredOrigin = resolveConfiguredOrigin();
  if (!configuredOrigin) {
    return typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  }

  if (
    typeof window !== "undefined" &&
    loopbackHosts.has(configuredOrigin.hostname) &&
    !loopbackHosts.has(window.location.hostname)
  ) {
    configuredOrigin.protocol = window.location.protocol;
    configuredOrigin.hostname = window.location.hostname;
  }

  return configuredOrigin.origin;
};
