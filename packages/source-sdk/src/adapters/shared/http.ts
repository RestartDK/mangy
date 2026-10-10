import { Data, Duration, Effect, Schedule } from "effect";

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

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly url: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly cause?: unknown;
}> {}

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

const toHttpError = (input: string | URL, cause: unknown): HttpError =>
  new HttpError({
    cause,
    message:
      cause instanceof Error
        ? cause.message
        : `Request failed for ${String(input)}`,
    retryable: true,
    url: String(input),
  });

const request = (
  input: string | URL,
  options: FetchRequestOptions
): Effect.Effect<Response, HttpError> =>
  Effect.tryPromise({
    catch: (cause) => toHttpError(input, cause),
    try: (signal) =>
      fetch(input, {
        headers: createRequestHeaders(options),
        redirect: "follow",
        signal,
      }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.succeed(response)
        : Effect.fail(
            new HttpError({
              message: `Request failed with status ${response.status} for ${String(input)}`,
              retryable: response.status >= 500 || response.status === 429,
              status: response.status,
              url: String(input),
            })
          )
    )
  );

const withAttemptTimeout = <A>(
  effect: Effect.Effect<A, HttpError>,
  input: string | URL,
  timeoutMs: number
): Effect.Effect<A, HttpError> =>
  effect.pipe(
    Effect.timeout(Duration.millis(timeoutMs)),
    Effect.catchTag("TimeoutError", () =>
      Effect.fail(
        new HttpError({
          message: `Request timed out after ${timeoutMs}ms for ${String(input)}`,
          retryable: true,
          url: String(input),
        })
      )
    )
  );

const retryPolicy = (times: number): Schedule.Schedule<Duration.Duration> =>
  Schedule.exponential("200 millis").pipe(
    Schedule.jittered,
    Schedule.upTo({ times })
  );

const retryTransient = <A, E extends { readonly retryable: boolean }>(
  effect: Effect.Effect<A, E>,
  times: number
): Effect.Effect<A, E> =>
  effect.pipe(
    Effect.retry({
      schedule: retryPolicy(times),
      while: (error) => error.retryable,
    })
  );

const fetchText = (
  input: string | URL,
  options: FetchRequestOptions
): Effect.Effect<FetchHtmlResult, HttpError> => {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  return withAttemptTimeout(
    request(input, options).pipe(
      Effect.flatMap((response) =>
        Effect.tryPromise({
          catch: (cause) => toHttpError(input, cause),
          try: () => response.text(),
        }).pipe(Effect.map((html) => ({ html, response })))
      )
    ),
    input,
    timeoutMs
  );
};

const fetchJsonBody = <TResponse>(
  input: string | URL,
  options: FetchRequestOptions
): Effect.Effect<TResponse, HttpError> => {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  return withAttemptTimeout(
    request(input, options).pipe(
      Effect.flatMap((response) =>
        Effect.tryPromise({
          catch: (cause) => toHttpError(input, cause),
          try: () => response.json() as Promise<TResponse>,
        })
      )
    ),
    input,
    timeoutMs
  );
};

export const fetchHtmlPage = (
  input: string | URL,
  options: FetchRequestOptions = {}
): Promise<FetchHtmlResult> =>
  Effect.runPromise(
    retryTransient(
      fetchText(input, {
        accept:
          options.accept ??
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        ...options,
      }),
      options.retries ?? defaultRetryCount
    )
  );

export const fetchJson = <TResponse>(
  input: string | URL,
  options: FetchRequestOptions = {}
): Promise<TResponse> =>
  Effect.runPromise(
    retryTransient(
      fetchJsonBody<TResponse>(input, {
        accept: options.accept ?? "application/json",
        ...options,
      }),
      options.retries ?? defaultRetryCount
    )
  );

export const resolveUrl = (baseUrl: string | URL, value: string): string => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return new URL(value, baseUrl).toString();
};
