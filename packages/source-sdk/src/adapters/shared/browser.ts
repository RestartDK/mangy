import { Effect, Semaphore } from "effect";
import type { Browser, LaunchOptions, Page } from "playwright";

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

export class BrowserUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BrowserUnavailableError";
  }
}

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

const acquirePageSlot = async (): Promise<void> => {
  if (browserCloseTimer) {
    clearTimeout(browserCloseTimer);
    browserCloseTimer = null;
  }

  await Effect.runPromise(pageSlots.take(1));

  activePages += 1;
};

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

const autoScroll = async (page: Page): Promise<void> => {
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
};

const isPlaywrightModule = (value: unknown): value is PlaywrightModule =>
  typeof value === "object" && value !== null && "chromium" in value;

const loadPlaywrightModule = async (): Promise<PlaywrightModule> => {
  const playwrightModule: unknown = await import(playwrightModuleName);

  if (!isPlaywrightModule(playwrightModule)) {
    throw new BrowserUnavailableError("Playwright could not be loaded.");
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

    throw new BrowserUnavailableError(
      error instanceof Error
        ? error.message
        : "Unable to launch the Playwright browser.",
      { cause: error }
    );
  }
};

const getBrowser = async (): Promise<Browser> => {
  browserPromise ??= launchBrowser();

  return await browserPromise;
};

const createHeaders = (options: BrowserPageOptions): Record<string, string> => {
  const headers = {
    ...options.headers,
  };

  if (options.referer && !headers.referer && !headers.Referer) {
    headers.Referer = options.referer;
  }

  return headers;
};

const releasePageSlot = (): void => {
  Effect.runSync(pageSlots.release(1));
  activePages = Math.max(0, activePages - 1);

  if (activePages === 0 && browserPromise && !browserCloseTimer) {
    browserCloseTimer = setTimeout(() => {
      browserCloseTimer = null;
      void closeBrowser();
    }, idleBrowserCloseDelayMs);
  }
};

export const withBrowserPage = async <TResult>(
  url: string,
  run: (page: Page) => Promise<TResult>,
  options: BrowserPageOptions = {}
): Promise<TResult> => {
  const browser = await getBrowser();
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  await acquirePageSlot();

  const context = await browser.newContext({
    extraHTTPHeaders: createHeaders(options),
    userAgent: options.userAgent ?? defaultUserAgent,
    viewport: { height: 900, width: 1440 },
  });

  try {
    if (options.localStorage && Object.keys(options.localStorage).length > 0) {
      const entries = Object.entries(options.localStorage);

      await context.addInitScript((values) => {
        const pageWindow = globalThis as unknown as BrowserWindow;

        for (const [key, value] of values) {
          pageWindow.localStorage.setItem(key, value);
        }
      }, entries);
    }

    const page = await context.newPage();

    await page.goto(url, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded",
    });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: timeoutMs,
      });
    }

    if (options.scrollToBottom) {
      await autoScroll(page);
    }

    if (options.waitAfterLoadMs && options.waitAfterLoadMs > 0) {
      await page.waitForTimeout(options.waitAfterLoadMs);
    }

    return await run(page);
  } finally {
    await context.close();
    releasePageSlot();
  }
};
