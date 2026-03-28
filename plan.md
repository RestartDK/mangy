# Manga App Rebuild Plan

## Goal

Rebuild this repository into a pure TypeScript manga discovery and download app that:

- lets users browse popular, latest, and trending manga like a manga site
- supports search and source-specific filters
- queues downloads to continue in the background even when the website is closed
- writes completed downloads to Komga destinations in a homelab setup
- tracks series and automatically queues new chapters when they release
- emits in-app notifications

Slack delivery is intentionally split into `slack-integration.md`.

## Core Product Direction

- Keep the monorepo shape: `apps/web`, `apps/server`, `packages/db`, `packages/auth`, `packages/env`
- Keep the typed Elysia to Treaty client flow already used by the repo
- Keep Better Auth as the base auth system
- Remove the old calendar and chat product completely
- Replace the frontend completely rather than reskinning the template
- Recreate Suwayomi behavior in pure TypeScript without depending on Suwayomi at runtime
- Build native TypeScript source adapters first instead of trying to run Mihon or JVM extensions directly

## Naming And API Conventions

- All TypeScript code uses `camelCase`
- Elysia route params, query objects, request bodies, response bodies, hook names, and component props stay `camelCase`
- Normalize external source payloads at the adapter boundary so `snake_case` does not leak into app code
- Drizzle model properties stay `camelCase`; SQL column names can be mapped internally if needed
- Follow Elysia conventions for typed route schemas and module composition

## What To Remove

### Frontend

Remove the old product UI and logic under:

- `apps/web/src/routes`
- `apps/web/src/components/calendar`
- `apps/web/src/components/chat`
- `apps/web/src/hooks/useEvents.ts` equivalent old hooks currently named `use-events.ts`
- `apps/web/src/hooks/useCalendars.ts` equivalent old hooks currently named `use-calendars.ts`
- `apps/web/src/context/pending-changes-context.tsx`
- template-specific auth presentation components that only exist for the old app

Keep only reusable low-level UI primitives in `apps/web/src/components/ui/`.

### Backend

Remove the old domain modules and integrations:

- `apps/server/src/modules/calendars`
- `apps/server/src/modules/events`
- `apps/server/src/modules/chat`
- `apps/server/src/google-calendar.ts`

### Database And Env

Remove or replace:

- `packages/db/src/schema/calendars.ts`
- `packages/db/src/schema/events.ts`
- Google Calendar and Gemini specific env requirements in `packages/env/src/index.ts`
- Google Calendar specific auth scopes in `packages/auth/src/index.ts`
- related task env entries in `turbo.json`

## What To Keep

- Monorepo and workspace layout
- Elysia server entry and feature-module structure
- Treaty typed client pattern
- Better Auth session flow
- Drizzle migrations and shared schema package
- TanStack Router and React Query foundations

## Target Architecture

### Apps

- `apps/web`: completely new manga-focused frontend
- `apps/server`: typed HTTP API and SSE endpoints
- `apps/worker`: background job runner for downloads, tracking, retries, and notification dispatch

### Packages

- `packages/db`: manga-oriented schema and migrations
- `packages/auth`: auth config without old Google Calendar assumptions
- `packages/env`: typed env for server, worker, and client
- `packages/sourceSdk`: source adapter interfaces and shared helper utilities
- `packages/downloader`: chapter download, packaging, filesystem output, and Komga integration helpers

## Backend Module Plan

Create feature-based modules under `apps/server/src/modules`:

- `sources`: source registry, capabilities, popular, latest, trending, search, filters
- `series`: series details, metadata refresh, chapter lists
- `library`: saved series, tracked series, destination assignment, auto-download settings
- `downloads`: enqueue, queue list, cancel, retry, reorder, progress snapshot
- `tracking`: tracked series state and manual refresh actions
- `notifications`: in-app notification feed and preferences
- `settings`: Komga config, destinations, source settings, account settings

Worker responsibilities:

- claim queued jobs from Postgres
- process chapter downloads outside request handlers
- apply retry and backoff behavior
- poll tracked series for new chapters
- emit progress events and notification events
- trigger Komga refresh behavior after successful downloads

## Source Engine Plan

Build a native TypeScript adapter SDK inspired by Suwayomi's runtime behavior.

Each adapter should expose a consistent contract such as:

- `getPopular`
- `getLatest`
- `getTrending` when the source supports it
- `searchSeries`
- `getFilters`
- `getSeries`
- `getChapters`
- `getPages`
- `downloadPage`

Key rules:

- source-specific formats are mapped into normalized app models at the adapter boundary
- source capability metadata drives the UI so unsupported features degrade gracefully
- no JVM or Mihon runtime dependency is allowed in the final product
- first ship a small set of high-value native adapters and expand later

## Data Model Plan

Replace the old calendar tables with manga-oriented tables:

- `source`
- `series`
- `chapter`
- `libraryEntry`
- `downloadDestination`
- `downloadJob`
- `downloadArtifact`
- `trackedSeriesState`
- `notificationEndpoint`
- `notification`

### Suggested Responsibilities

- `source`: adapter identity, enabled state, capabilities, health metadata
- `series`: normalized manga record keyed by `sourceId` and external series id
- `chapter`: normalized chapter metadata and download state
- `libraryEntry`: user relationship to a series, including `isTracked`, `autoDownload`, and default destination
- `downloadDestination`: filesystem destination for Komga imports
- `downloadJob`: durable queue row with state, progress, attempts, lease ownership, and error details
- `downloadArtifact`: saved output path, packaging metadata, and Komga import state
- `trackedSeriesState`: last checked time and latest known chapter state for tracked series
- `notificationEndpoint`: delivery preferences and channel configuration
- `notification`: in-app notification records

## Queue And Background Processing Plan

- Use a Postgres-backed durable queue first
- Jobs must continue when the browser is closed
- Downloads must not run inside HTTP request handlers
- Support job states: `queued`, `running`, `retryableFailed`, `completed`, `cancelled`
- Use lease-based job claiming so multiple workers can be added later
- Enforce both global concurrency and per-source concurrency
- Persist enough state to recover cleanly after restarts
- Add retry with exponential backoff and clear human-readable error messages

## Komga Integration Plan

- Primary path: write completed downloads directly into configured Komga-watched folders
- Support per-series destination selection
- Centralize naming rules and file packaging so Komga imports stay consistent
- Optionally trigger a Komga library scan after completion
- Capture Komga import failures separately from download failures

## Frontend Rebuild Plan

Completely replace the current UI with a manga-focused experience.

### App Shell

- authenticated shell with top navigation and responsive mobile layout
- no reused calendar layout or chat panel structure
- fresh visual system in `apps/web/src/index.css`

### Pages

- `discover`: popular, latest, trending shelves
- `search`: query, source picker, dynamic filters, result grid
- `series`: metadata, chapter list, track toggle, destination picker, queue actions
- `queue`: active, pending, completed, and failed jobs with progress
- `library`: tracked and saved series
- `notifications`: in-app feed
- `settings`: Komga, destinations, source settings, account
- `login`: minimal auth UI, rebuilt to match the new app

### Frontend Architecture

- keep TanStack Router
- keep React Query
- create manga-specific hooks instead of reusing old calendar hooks
- use typed Treaty calls for all app data
- use SSE for live queue updates before considering WebSockets

## Notification Scope

In the main plan, notification support includes:

- in-app notifications for queue success, queue failure, tracked-series updates, and system warnings
- notification preferences stored per user

Slack-specific design and delivery behavior live in `slack-integration.md`.

## Implementation Phases

### Phase 1: Cleanup The Template

- remove old calendar and chat domain code
- remove old route components and page structure
- simplify auth and env assumptions
- update README and project naming where needed

### Phase 2: New Domain Foundation

- add manga schema to `packages/db`
- add migrations
- create server module skeletons
- create shared source SDK package

### Phase 3: Source Browsing APIs

- implement adapter registry
- build first native source adapters
- add discover and search endpoints
- add dynamic filter contracts

### Phase 4: New Frontend

- build the new shell, routes, and design system
- implement discover, search, and series detail pages
- wire typed hooks to the new APIs

### Phase 5: Queue And Downloads

- add durable queue tables and worker app
- implement chapter download flow and artifact packaging
- add queue management APIs and queue UI
- write outputs to Komga destinations

### Phase 6: Tracking Automation

- add tracked-series state
- schedule periodic refresh checks
- detect new chapters and auto-enqueue them
- show tracking state in library and series pages

### Phase 7: Notifications

- implement in-app notification records and APIs
- add live UI updates for queue and tracking events
- add Slack delivery based on the separate Slack plan

### Phase 8: Hardening

- retry and rate-limit tuning
- source failure handling
- worker recovery behavior
- filesystem cleanup for partial downloads
- documentation and deployment polish

## Default Technical Decisions

- Better Auth stays
- email and password should be the default auth path first
- SSE is the first live-update transport
- Postgres is the first queue backend
- filesystem output targets Komga watch folders first
- native TypeScript adapters come before any experimental compatibility layer

## Risks And Tradeoffs

- Source maintenance is the biggest long-term cost because websites change often
- Trending and advanced filters are not uniform across sources, so the UI must be capability-driven
- Download workers need strong partial-file cleanup and recovery logic
- Broad Mihon extension compatibility would be a separate major project and is intentionally out of scope for the first implementation

## First Build Slice

The first vertical slice should deliver:

- authentication
- discover page with at least one adapter
- series detail page with chapters
- enqueue chapter download to a configured destination
- worker processes the job in the background
- queue page shows live progress
- basic tracked-series auto-download
- basic in-app notifications

That slice proves the core product loop before scaling to more sources and more automation.
