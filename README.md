# Mangy

![Mangy mascot](apps/web/public/mangy.png)

Mangy is a pure TypeScript manga discovery, download, and tracking app for homelab setups.

It replaces a Suwayomi-based workflow with a typed monorepo that includes:

- a React web app for discovery, queue management, library state, and notifications
- an Elysia API with typed Treaty clients
- a background worker that processes downloads and tracked-series checks even when the browser is closed
- direct filesystem output to Komga-watched folders

Slack planning is intentionally separated into `slack-integration.md`.

## Current Product Slice

The current implementation covers the core vertical slice:

- email/password authentication with Better Auth
- discover and search APIs with a native TypeScript source adapter
- series detail pages with chapter queueing
- durable Postgres-backed download queue
- worker-driven chapter downloads to configured destinations
- tracked series with manual refresh and auto-download of new chapters
- in-app notifications for download and tracking events
- SSE-based live invalidation for queue, tracking, and notification UIs
- queue controls for cancel, retry, and move-to-front

## Monorepo Layout

```text
mangy/
├── apps/
│   ├── web/         # React + TanStack Router frontend
│   ├── server/      # Elysia API server
│   └── worker/      # Background queue and tracking worker
├── packages/
│   ├── auth/        # Better Auth configuration
│   ├── db/          # Drizzle schema and migrations
│   ├── downloader/  # Filesystem download helpers
│   ├── env/         # Typed environment access
│   ├── source-sdk/  # Source adapter contracts and adapters
│   └── config/      # Shared TypeScript config
└── plan.md          # Rebuild plan and phase tracking
```

## Prerequisites

- Bun `1.3.4` or newer
- Docker, for the local PostgreSQL service

## Getting Started

Install dependencies:

```bash
bun install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Required environment values:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mangy
BETTER_AUTH_SECRET=replace-with-a-32-character-secret
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
HOST=0.0.0.0
PORT=3000
VITE_SERVER_URL=http://localhost:3000
WORKER_POLL_INTERVAL_MS=15000
TRACKING_POLL_INTERVAL_MS=900000
```

Start the database and apply migrations:

```bash
bun db:start
bun db:migrate
```

Run the whole stack:

```bash
bun dev
```

Useful focused commands:

```bash
bun dev:web
bun dev:server
bun dev:worker
```

Default local URLs:

- web: `http://localhost:3001`
- server: `http://localhost:3000`

## Commands

| Command | Purpose |
| --- | --- |
| `bun dev` | Run web, server, and worker together |
| `bun build` | Build all workspaces |
| `bun check-types` | Run workspace TypeScript checks |
| `bun check` | Run Biome formatting and checks |
| `bun db:start` | Start PostgreSQL via Docker |
| `bun db:migrate` | Apply Drizzle migrations |
| `bun db:studio` | Open Drizzle Studio |
| `bun test:integration` | Run the server/worker integration test suite |

## Testing

Integration coverage currently exercises the real app flow through the server and worker:

- destination creation
- chapter enqueueing
- queue actions
- worker download processing
- tracked-series auto-download flow
- notification APIs
- SSE event delivery

Run it with:

```bash
bun test:integration
```

This test expects the local database to be running and migrated.

## Architecture Notes

- `apps/server` exposes feature modules for sources, series, library, downloads, tracking, notifications, settings, and live events
- `apps/worker` claims jobs from Postgres, downloads chapter pages, updates queue state, and checks tracked series on a schedule
- source adapters normalize external payloads at the adapter boundary so app code stays camelCase
- completed downloads are written directly into configured filesystem destinations for Komga import

## Deployment Notes

Mangy is intended to run as separate web, server, and worker services.

- web and server are built with Railpack-compatible workspace builds
- PostgreSQL is an external persistent dependency
- the worker must run anywhere the configured download destinations are reachable
- Komga can watch those destination folders directly

This repo now covers image build and publish concerns only:

- `Dockerfile` builds `web`, `server`, and `worker` container images
- `compose.example.yml` is a reference Podman/Docker Compose template for GHCR-based runtime wiring
- `compose.env.example` is the matching example env file for that compose template
- `.github/workflows/ci.yml` runs pull request validation, including integration tests against PostgreSQL
- `.github/workflows/publish.yml` publishes private GHCR images on pushes to `main`
- host-specific Podman Compose files, env files, and update scripts are expected to live outside this repo, such as under `/opt/homelab/`
- `docs/homelab-ghcr.md` explains the intended split between this repo and your homelab runtime config

## Status

The project has moved well beyond the old calendar template, but some polish work is still ongoing:

- queue and tracking core flows are live
- notification preferences and SSE invalidation are live
- Slack delivery remains a separate follow-on from `slack-integration.md`
- broader hardening and cleanup continue in the remaining implementation work
