export const defaultUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const defaultAcceptLanguage = "en-US,en;q=0.9,it;q=0.8";
const defaultTimeoutMs = 10_000;
const defaultRetryCount = 2;

type HeaderInput = Headers | Record<string, string> | [string, string][];

export interface FetchRequestOptions {
  accept?: string;
  headers?: HeaderInput;
  referer?: string;
  retries?: number;
  timeoutMs?: number;
}

export interface FetchHtmlResult {
  html: string;
  response: Response;
}

const createRequestHeaders = (options: FetchRequestOptions): Headers => {
  const headers = new Headers(options.headers);

  if (!headers.has("accept-language")) {
    headers.set("accept-language", defaultAcceptLanguage);
  }

  if (!headers.has("user-agent")) {
    headers.set("user-agent", defaultUserAgent);
  }

  if (options.accept && !headers.has("accept")) {
    headers.set("accept", options.accept);
  }

  if (options.referer && !headers.has("referer")) {
    headers.set("referer", options.referer);
  }

  return headers;
};

const runWithTimeout = async <TResult>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<TResult>
): Promise<TResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const fetchWithRetry = async (
  input: string | URL,
  options: FetchRequestOptions
): Promise<Response> => {
  const retries = options.retries ?? defaultRetryCount;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await runWithTimeout(timeoutMs, (signal) =>
        fetch(input, {
          headers: createRequestHeaders(options),
          redirect: "follow",
          signal,
        })
      );

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          continue;
        }

        throw new Error(
          `Request failed with status ${response.status} for ${String(input)}`
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
  }

  throw lastError ?? new Error(`Request failed for ${String(input)}`);
};

export const fetchHtmlPage = async (
  input: string | URL,
  options: FetchRequestOptions = {}
): Promise<FetchHtmlResult> => {
  const response = await fetchWithRetry(input, {
    accept:
      options.accept ??
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    ...options,
  });

  return {
    html: await response.text(),
    response,
  };
};

export const fetchJson = async <TResponse>(
  input: string | URL,
  options: FetchRequestOptions = {}
): Promise<TResponse> => {
  const response = await fetchWithRetry(input, {
    accept: options.accept ?? "application/json",
    ...options,
  });

  return (await response.json()) as TResponse;
};

export const resolveUrl = (baseUrl: string | URL, value: string): string => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return new URL(value, baseUrl).toString();
};
