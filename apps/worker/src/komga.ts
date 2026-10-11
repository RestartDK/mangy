import { env } from "@mangy/env";

interface KomgaScanInput {
  libraryId: string | null;
}

interface KomgaConfig {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  password: string | undefined;
  username: string | undefined;
}

let configOverride: KomgaConfig | null = null;
const trailingSlashesPattern = /\/+$/u;

const trimTrailingSlashes = (value: string): string =>
  value.replace(trailingSlashesPattern, "");

const getKomgaConfig = (): KomgaConfig =>
  configOverride ?? {
    apiKey: env.KOMGA_API_KEY,
    baseUrl: env.KOMGA_BASE_URL,
    password: env.KOMGA_PASSWORD,
    username: env.KOMGA_USERNAME,
  };

const createBasicAuthHeader = (
  username: string | undefined,
  password: string | undefined
): string | null => {
  if (
    username === undefined ||
    username.length === 0 ||
    password === undefined ||
    password.length === 0
  ) {
    return null;
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
};

const createKomgaHeaders = (config: KomgaConfig): Headers => {
  const headers = new Headers();

  if (config.apiKey !== undefined && config.apiKey.length > 0) {
    headers.set("X-API-Key", config.apiKey);
    return headers;
  }

  const basicAuthHeader = createBasicAuthHeader(
    config.username,
    config.password
  );
  if (basicAuthHeader !== null) {
    headers.set("Authorization", basicAuthHeader);
  }

  return headers;
};

export const setKomgaConfigForTests = (config: KomgaConfig | null): void => {
  configOverride = config;
};

export const scanKomgaLibrary = async ({
  libraryId,
}: KomgaScanInput): Promise<Date | null> => {
  if (libraryId === null || libraryId.length === 0) {
    return null;
  }

  const config = getKomgaConfig();
  if (config.baseUrl === undefined || config.baseUrl.length === 0) {
    throw new Error(
      "This destination has a Komga library ID, but KOMGA_BASE_URL is not configured."
    );
  }

  const scanUrl = `${trimTrailingSlashes(config.baseUrl)}/api/v1/libraries/${encodeURIComponent(libraryId)}/scan`;
  const response = await fetch(scanUrl, {
    headers: createKomgaHeaders(config),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Komga library scan failed with status ${response.status}.`
    );
  }

  return new Date();
};
