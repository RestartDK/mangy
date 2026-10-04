# Source Architecture

Mangy ships one source adapter: WeebCentral. Source adapters normalize external payloads at the adapter boundary so app code stays camelCase and source-agnostic. This document covers the contract, the browser support model, and the rules for adding a source later.

## Source SDK

- `packages/source-sdk/src/types.ts`
  - keeps the public adapter contract centered on:
    - `getPopular`
    - `getLatest`
    - `getTrending?`
    - `searchSeries`
    - `getFilters`
    - `getSeries`
    - `getChapters`
    - `getPages`
  - extends `SourcePage` with request metadata:
    - `headers?: Record<string, string>`
    - `referer?: string`
- `packages/source-sdk/src/registry.ts`
  - global adapter registry
  - registers WeebCentral
- shared adapter internals live in:
  - `packages/source-sdk/src/adapters/shared/http.ts`
  - `packages/source-sdk/src/adapters/shared/html.ts`
  - `packages/source-sdk/src/adapters/shared/browser.ts`

## WeebCentral

- File: `packages/source-sdk/src/adapters/weeb-central.ts`
- Style:
  - HTML search/details/chapters
  - browser-assisted page extraction via Playwright where the site requires it
  - fallback to direct image endpoint parsing when browser rendering is unavailable
- Supports:
  - filters
  - search
  - popular/latest
  - series details
  - chapter list
  - page extraction

## Browser Support Model

Browser support stays internal to source-sdk.

- `packages/source-sdk/src/adapters/shared/browser.ts`
  - uses Playwright internally
  - lazy-loads Playwright so worker/server builds do not bundle browser internals
  - browsers are only used when the HTTP path cannot produce the data
  - throttles concurrent browser pages
  - closes the shared browser after idle periods

Browser concepts do not leak into server modules, worker modules, or web code.

The deployed worker runs without a browser runtime, so page extraction must always degrade to the HTTP path when the browser is unavailable.

## Environment Plan

If more browser-backed sources are added, browser runtime should remain configurable through typed env.

### Suggested env vars

- `PLAYWRIGHT_HEADLESS`
- `PLAYWRIGHT_BROWSER_PATH`
- `PLAYWRIGHT_TIMEOUT_MS`
- `PLAYWRIGHT_DISABLE_SANDBOX`

### Required follow-up wiring

- add them to `packages/env/src/index.ts`
- add them to `turbo.json` task `env` arrays for:
  - `dev`
  - `server#start`
  - `server#dev`
  - `server#test:integration`
  - `worker#start`
  - `worker#dev`

## Testing Strategy

### Implemented

- fixture parser tests in `packages/source-sdk/tests/weeb-central.test.ts`
- live adapter smoke in `packages/source-sdk/tests/weeb-central.live.test.ts`
- server integration in `apps/server/tests/integration.test.ts`
- live running-server route smoke in `apps/server/tests/live-routes.ts`

### Next improvement

Extract a reusable adapter contract harness so new sources do not need to duplicate the same assertions.

Suggested location:

- `packages/source-sdk/tests/helpers/adapter-contract.ts`

Suggested reusable checks:

- metadata shape
- popular/latest/search pagination shape
- normalized series fields
- chapter ordering and non-empty results
- page list non-empty for smoke targets
- page request metadata presence where expected

## Adding A Source

A new source ships as a single adapter file plus fixtures and tests. Follow the existing split:

- export from `packages/source-sdk/src/index.ts`
- register in `packages/source-sdk/src/registry.ts`
- add fixtures
- add fixture parser tests and a live smoke test
- add live route smoke coverage in `apps/server/tests/live-routes.ts`
- update this doc and `README.md`

## Design Rules For Future Sources

- keep a single registry and a single app-facing API
- do not create a separate `tranga/` folder
- keep browser support internal to source-sdk
- keep server/web code source-agnostic
- extend request metadata on normalized page models instead of leaking source-specific logic into the downloader or reader
- prefer browser rendering only for the hardest parts, usually `getPages()` first