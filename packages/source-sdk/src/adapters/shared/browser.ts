import { Data, Effect, Semaphore } from "effect";
import type { Browser, LaunchOptions, Page } from "playwright";

import { hasText } from "./html";
import { defaultUserAgent } from "./http";

const defaultTimeoutMs = 20_000;
const idleBrowserCloseDelayMs = 1000;
const maxConcurrentPages = 2;
const playwrightModuleName = ["play", "wright"].join("");

interface BrowserLocalStorage {
  setItem: (key: string, value: string) => void;
}

interface BrowserDocument {
  body: {
    scrollHeight: number;
  };
}

interface BrowserWindow {
  clearInterval: (timer: ReturnType<typeof setInterval>) => void;
  document: BrowserDocument;
  innerHeight: number;
  localStorage: BrowserLocalStorage;
  scrollBy: (x: number, y: number) => void;
  setInterval: (
    handler: () => void,
    timeout: number
  ) => ReturnType<typeof setInterval>;
}

interface PlaywrightModule {
  chromium: {
    launch: (options: LaunchOptions) => Promise<Browser>;
  };
}

export class BrowserUnavailableError extends Data.TaggedError(
  "BrowserUnavailableError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface BrowserPageOptions {
  headers?: Record<string, string>;
  localStorage?: Record<string, string>;
  referer?: string;
  scrollToBottom?: boolean;
  timeoutMs?: number;
  userAgent?: string;
  waitAfterLoadMs?: number;
  waitForSelector?: string;
}

let browserPromise: Promise<Browser> | null = null;
let browserCloseTimer: ReturnType<typeof setTimeout> | null = null;
let activePages = 0;

const pageSlots = Semaphore.makeUnsafe(maxConcurrentPages);

const browserUnavailable = (
  message: string,
  cause?: unknown
): BrowserUnavailableError => new BrowserUnavailableError({ cause, message });

const acquirePageSlot = (): Effect.Effect<void> =>
  Effect.gen(function* acquirePageSlotEffect() {
    if (browserCloseTimer) {
      clearTimeout(browserCloseTimer);
      browserCloseTimer = null;
    }

    yield* pageSlots.take(1);
    activePages += 1;
  });

const closeBrowser = async (): Promise<void> => {
  const currentBrowserPromise = browserPromise;

  browserPromise = null;

  if (!currentBrowserPromise) {
    return;
  }

  try {
    const browser = await currentBrowserPromise;
    await browser.close();
  } catch {
    // Ignore browser shutdown errors.
  }
};

const releasePageSlot = (): Effect.Effect<void> =>
  Effect.gen(function* releasePageSlotEffect() {
    yield* pageSlots.release(1);
    activePages = Math.max(0, activePages - 1);

    if (activePages === 0 && browserPromise && !browserCloseTimer) {
      browserCloseTimer = setTimeout(() => {
        browserCloseTimer = null;
        void closeBrowser();
      }, idleBrowserCloseDelayMs);
    }
  });

const autoScroll = (page: Page): Effect.Effect<void, BrowserUnavailableError> =>
  Effect.tryPromise({
    catch: (cause) => browserUnavailable("Unable to scroll the page.", cause),
    try: async () => {
      await page.evaluate(async () => {
        const pageWindow = globalThis as unknown as BrowserWindow;
        const { promise, resolve } = Promise.withResolvers<unknown>();
        let totalHeight = 0;
        const distance = pageWindow.innerHeight * 0.8;
        const timer = pageWindow.setInterval(() => {
          const { scrollHeight } = pageWindow.document.body;
          pageWindow.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            pageWindow.clearInterval(timer);
            resolve(null);
          }
        }, 150);

        await promise;
      });
    },
  });

const isPlaywrightModule = (value: unknown): value is PlaywrightModule =>
  typeof value === "object" && value !== null && "chromium" in value;

const loadPlaywrightModule = async (): Promise<PlaywrightModule> => {
  const playwrightModule: unknown = await import(playwrightModuleName);

  if (!isPlaywrightModule(playwrightModule)) {
    throw new BrowserUnavailableError({
      message: "Playwright could not be loaded.",
    });
  }

  return playwrightModule;
};

const launchBrowser = async (): Promise<Browser> => {
  try {
    const playwright = await loadPlaywrightModule();

    return await playwright.chromium.launch({
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      headless: true,
    });
  } catch (error) {
    browserPromise = null;

    throw new BrowserUnavailableError({
      cause: error,
      message:
        error instanceof Error
          ? error.message
          : "Unable to launch the Playwright browser.",
    });
  }
};

const getBrowser = (): Effect.Effect<Browser, BrowserUnavailableError> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof BrowserUnavailableError
        ? cause
        : browserUnavailable("Unable to launch the Playwright browser.", cause),
    try: async () => {
      browserPromise ??= launchBrowser();

      return await browserPromise;
    },
  });

const createHeaders = (options: BrowserPageOptions): Record<string, string> => {
  const headers = {
    ...options.headers,
  };

  if (
    hasText(options.referer) &&
    !hasText(headers.referer) &&
    !hasText(headers.Referer)
  ) {
    headers.Referer = options.referer;
  }

  return headers;
};

export const withBrowserPage = <TResult, E>(
  url: string,
  run: (page: Page) => Effect.Effect<TResult, E>,
  options: BrowserPageOptions = {}
): Effect.Effect<TResult, BrowserUnavailableError | E> =>
  Effect.acquireUseRelease(
    acquirePageSlot(),
    () =>
      Effect.gen(function* withBrowserPageEffect() {
        const browser = yield* getBrowser();
        const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
        const context = yield* Effect.tryPromise({
          catch: (cause) =>
            browserUnavailable("Unable to open a browser context.", cause),
          try: async () =>
            await browser.newContext({
              extraHTTPHeaders: createHeaders(options),
              userAgent: options.userAgent ?? defaultUserAgent,
              viewport: { height: 900, width: 1440 },
            }),
        });

        return yield* Effect.gen(function* runBrowserPageEffect() {
          if (
            options.localStorage &&
            Object.keys(options.localStorage).length > 0
          ) {
            const entries = Object.entries(options.localStorage);

            yield* Effect.tryPromise({
              catch: (cause) =>
                browserUnavailable("Unable to seed browser storage.", cause),
              try: async () =>
                await context.addInitScript((values) => {
                  const pageWindow = globalThis as unknown as BrowserWindow;

                  for (const [key, value] of values) {
                    pageWindow.localStorage.setItem(key, value);
                  }
                }, entries),
            });
          }

          const page = yield* Effect.tryPromise({
            catch: (cause) =>
              browserUnavailable("Unable to open a browser page.", cause),
            try: async () => await context.newPage(),
          });

          yield* Effect.tryPromise({
            catch: (cause) =>
              browserUnavailable(`Unable to open ${url}.`, cause),
            try: async () =>
              await page.goto(url, {
                timeout: timeoutMs,
                waitUntil: "domcontentloaded",
              }),
          });

          const selector = options.waitForSelector;
          if (hasText(selector)) {
            yield* Effect.tryPromise({
              catch: (cause) =>
                browserUnavailable(`Unable to find ${selector}.`, cause),
              try: async () =>
                await page.waitForSelector(selector, { timeout: timeoutMs }),
            });
          }

          if (options.scrollToBottom === true) {
            yield* autoScroll(page);
          }

          const { waitAfterLoadMs } = options;
          if (waitAfterLoadMs !== undefined && waitAfterLoadMs > 0) {
            yield* Effect.tryPromise({
              catch: (cause) =>
                browserUnavailable("Unable to wait after page load.", cause),
              try: async () => {
                await page.waitForTimeout(waitAfterLoadMs);
              },
            });
          }

          return yield* run(page);
        }).pipe(
          Effect.ensuring(
            Effect.promise(async () => {
              await context.close();
            }).pipe(Effect.ignoreCause)
          )
        );
      }),
    () => releasePageSlot()
  );
