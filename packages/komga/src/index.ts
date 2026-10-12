import { env } from "@mangy/env";
import { Schema } from "effect";

const komgaLibrarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  root: Schema.String,
});

const komgaLibrariesSchema = Schema.Array(komgaLibrarySchema);

export type KomgaLibrary = typeof komgaLibrarySchema.Type;
export type KomgaLibraries = typeof komgaLibrariesSchema.Type;

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
const requestTimeoutMs = 5000;
const trailingSlashesPattern = /\/+$/u;

const trimTrailingSlashes = (value: string): string =>
  value.replace(trailingSlashesPattern, "");

const fetchKomga = async (
  url: string,
  init: RequestInit
): Promise<Response> => {
  const signal = AbortSignal.timeout(requestTimeoutMs);

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    const reason = signal.aborted
      ? `Komga did not respond within ${requestTimeoutMs} ms.`
      : `Komga request failed: ${error instanceof Error ? error.message : "unknown error"}.`;

    throw new Error(reason, { cause: error });
  }
};

const getKomgaConfig = (): KomgaConfig =>
  configOverride ?? {
    apiKey: env.KOMGA_API_KEY,
    baseUrl: env.KOMGA_BASE_URL,
    password: env.KOMGA_PASSWORD,
    username: env.KOMGA_USERNAME,
  };

const hasBaseUrl = (
  config: KomgaConfig
): config is KomgaConfig & { baseUrl: string } =>
  typeof config.baseUrl === "string" && config.baseUrl.length > 0;

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

const parseKomgaLibraries = (payload: unknown): KomgaLibraries => {
  const decoded = Schema.decodeUnknownResult(komgaLibrariesSchema)(payload);

  if (decoded._tag === "Failure") {
    throw new Error("Komga returned a library list this app cannot read.");
  }

  return decoded.success;
};

export const setKomgaConfigForTests = (config: KomgaConfig | null): void => {
  configOverride = config;
};

export const hasKomgaConfig = (): boolean => hasBaseUrl(getKomgaConfig());

export const listKomgaLibraries = async (): Promise<KomgaLibraries> => {
  const config = getKomgaConfig();
  if (!hasBaseUrl(config)) {
    throw new Error("KOMGA_BASE_URL is not configured.");
  }

  const response = await fetchKomga(
    `${trimTrailingSlashes(config.baseUrl)}/api/v1/libraries`,
    { headers: createKomgaHeaders(config) }
  );

  if (!response.ok) {
    throw new Error(
      `Komga library list failed with status ${response.status}.`
    );
  }

  return parseKomgaLibraries(await response.json());
};

export const scanKomgaLibrary = async ({
  libraryId,
}: KomgaScanInput): Promise<Date | null> => {
  if (libraryId === null || libraryId.length === 0) {
    return null;
  }

  const config = getKomgaConfig();
  if (!hasBaseUrl(config)) {
    throw new Error(
      "This destination has a Komga library ID, but KOMGA_BASE_URL is not configured."
    );
  }

  const scanUrl = `${trimTrailingSlashes(config.baseUrl)}/api/v1/libraries/${encodeURIComponent(libraryId)}/scan`;
  const response = await fetchKomga(scanUrl, {
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
