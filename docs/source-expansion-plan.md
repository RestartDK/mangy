# Multi-Source Expansion Plan

This document captures the current Tranga-inspired source architecture in this repo, what was already shipped in this PR, and the remaining expansion plan for future work.

## Current State

The repo now supports a normalized multi-source flow without introducing a separate `tranga/` subsystem.

### Source SDK

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
  - now registers:
    - `mangaDex`
    - `mangaWorld`
    - `weebCentral`
- shared adapter internals live in:
  - `packages/source-sdk/src/adapters/shared/http.ts`
  - `packages/source-sdk/src/adapters/shared/html.ts`
  - `packages/source-sdk/src/adapters/shared/browser.ts`

### Server

- `apps/server/src/modules/sources/index.ts`
  - already exposes source discovery and search APIs
- `apps/server/src/modules/series/index.ts`
  - now exposes page and image reader endpoints:
    - `GET /api/series/:seriesId/chapters/:chapterId/pages?sourceId=...`
    - `GET /api/series/:seriesId/chapters/:chapterId/pages/:pageIndex/image?sourceId=...`
- `apps/server/src/modules/series/service.ts`
  - normalizes page lists for the web app
  - proxies image bytes while honoring source page request metadata

### Worker + Downloader

- `apps/worker/src/runner.ts`
  - passes page headers and referer metadata into downloads
- `packages/downloader/src/index.ts`
  - attaches page request metadata when fetching source images

### Web

- `apps/web/src/routes/series.$sourceId.$seriesId.read.$chapterId.tsx`
  - server-backed reader route
- `apps/web/src/hooks/use-chapter-pages.ts`
  - fetches normalized page lists from the server
- chapter read actions are wired from the series route into the reader

## Shipped Source Adapters

### MangaWorld

- File: `packages/source-sdk/src/adapters/manga-world.ts`
- Style:
  - HTML scraping with `fetch + cheerio`
- Supports:
  - filters
  - search
  - popular/latest
  - series details
  - chapter list
  - page extraction

### WeebCentral

- File: `packages/source-sdk/src/adapters/weeb-central.ts`
- Style:
  - HTML search/details/chapters
  - browser-assisted page extraction via Playwright
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
  - throttles concurrent browser pages
  - closes the shared browser after idle periods
- Browser concepts do not leak into:
  - server modules
  - worker modules
  - web code

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

- fixture parser tests in:
  - `packages/source-sdk/tests/manga-world.test.ts`
  - `packages/source-sdk/tests/weeb-central.test.ts`
- live adapter smokes in:
  - `packages/source-sdk/tests/manga-world.live.test.ts`
  - `packages/source-sdk/tests/weeb-central.live.test.ts`
- server integration in:
  - `apps/server/tests/integration.test.ts`
- live running-server route smoke in:
  - `apps/server/tests/live-routes.ts`

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

## Remaining Source Expansion Work

The initial plan is functionally complete for phase 1 and the first browser-backed phase. Remaining work is expansion work.

### 1. Add another browser-backed source

Recommended next source: `AsuraComic`

Suggested file:

- `packages/source-sdk/src/adapters/asura-comic.ts`

Implementation direction:

- use Tranga's `AsuraComic` connector as reference for:
  - search URL shape
  - slug parsing
  - detail parsing
  - chapter ordering
  - page extraction strategy
- adapt it into this repo's normalized `SourceAdapter` contract
- prefer the same split as the WeebCentral adapter:
  - HTML for search/details/chapters
  - browser-only where necessary for `getPages()`

Required follow-up:

- export from `packages/source-sdk/src/index.ts`
- register in `packages/source-sdk/src/registry.ts`
- add fixtures
- add live smoke test
- add live route smoke coverage in `apps/server/tests/live-routes.ts`

### 2. Generic adapter contract harness

Move repeated test behavior into shared helpers and keep per-source fixtures focused on selectors and edge cases.

### 3. Docs cleanup

When adding more sources, update `README.md` with:

- available sources
- how to run live smoke tests
- browser runtime notes for Fedora/CI

## Verification Commands

### Implemented commands

- `bun check`
- `bun check-types`
- `bun test:sources`
- `bun test:sources:live`
- `bun test:integration`
- `bun test:routes:live`
- `bun run build`

### Source package helpers

- root `package.json`
  - `test:sources`
  - `test:sources:live`
  - `test:routes:live`
- `packages/source-sdk/package.json`
  - `test`
  - `test:live`
- `apps/server/package.json`
  - `test:integration`
  - `test:live-routes`

## Design Rules For Future Sources

- keep a single registry and a single app-facing API
- do not create a separate `tranga/` folder
- keep browser support internal to source-sdk
- keep server/web code source-agnostic
- extend request metadata on normalized page models instead of leaking source-specific logic into the downloader or reader
- prefer browser rendering only for the hardest parts, usually `getPages()` first
