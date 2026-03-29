import type { Browser, Page } from "playwright";

import { defaultUserAgent } from "./http";

const defaultTimeoutMs = 20_000;
const idleBrowserCloseDelayMs = 1000;
const maxConcurrentPages = 2;
const playwrightModuleName = ["play", "wright"].join("");

type PlaywrightModule = typeof import("playwright");

interface BrowserLocalStorage {
  setItem(key: string, value: string): void;
}

interface BrowserDocument {
  body: {
    scrollHeight: number;
  };
}

interface BrowserWindow {
  clearInterval(timer: ReturnType<typeof setInterval>): void;
  document: BrowserDocument;
  innerHeight: number;
  localStorage: BrowserLocalStorage;
  scrollBy(x: number, y: number): void;
  setInterval(
    handler: () => void,
    timeout: number
  ): ReturnType<typeof setInterval>;
}

export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
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

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const acquirePageSlot = async (): Promise<void> => {
  if (browserCloseTimer) {
    clearTimeout(browserCloseTimer);
    browserCloseTimer = null;
  }

  while (activePages >= maxConcurrentPages) {
    await sleep(50);
  }

  activePages += 1;
};

const releasePageSlot = (): void => {
  activePages = Math.max(0, activePages - 1);

  if (activePages === 0 && browserPromise && !browserCloseTimer) {
    browserCloseTimer = setTimeout(() => {
      browserCloseTimer = null;
      closeBrowser().catch(() => undefined);
    }, idleBrowserCloseDelayMs);
  }
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

    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = pageWindow.innerHeight * 0.8;
      const timer = pageWindow.setInterval(() => {
        const scrollHeight = pageWindow.document.body.scrollHeight;
        pageWindow.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          pageWindow.clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
};

const loadPlaywrightModule = async (): Promise<PlaywrightModule> => {
  return (await import(playwrightModuleName)) as PlaywrightModule;
};

const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = loadPlaywrightModule()
      .then((playwright) =>
        playwright.chromium.launch({
          args: [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
          headless: true,
        })
      )
      .catch((error: unknown) => {
        browserPromise = null;

        throw new BrowserUnavailableError(
          error instanceof Error
            ? error.message
            : "Unable to launch the Playwright browser."
        );
      });
  }

  return browserPromise;
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

export const withBrowserPage = async <TResult>(
  url: string,
  callback: (page: Page) => Promise<TResult>,
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
      const entries = Object.entries(options.localStorage) as [
        string,
        string,
      ][];

      await context.addInitScript(
        (values) => {
          const pageWindow = globalThis as unknown as BrowserWindow;

          for (const [key, value] of values) {
            pageWindow.localStorage.setItem(key, value);
          }
        },
        entries as [string, string][]
      );
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

    return await callback(page);
  } finally {
    await context.close();
    releasePageSlot();
  }
};

export const fetchRenderedHtml = (
  url: string,
  options: BrowserPageOptions = {}
): Promise<{ html: string; url: string }> => {
  return withBrowserPage(
    url,
    async (page) => ({
      html: await page.content(),
      url: page.url(),
    }),
    options
  );
};
