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

- Bun `1.3.4` or newer (or the `nix develop` dev shell, which provides Bun and PostgreSQL)

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
| `bun db:start` | Start the local PostgreSQL data dir (`.mangy-postgres`) |
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
- completed downloads are written directly into configured filesystem destinations and can trigger Komga library scans when a destination has a Komga library ID

## Deployment Notes

Mangy runs as three processes against a Postgres database: the web app (static files), the API server, and the worker. The repo ships a Nix flake with everything a host needs.

- `nix build .#mangy-web` produces the static web build, origin-agnostic and safe to serve from any front
- `nix build .#mangy-app` produces the runtime bundle for the server and worker, run with `bun run apps/server/src/index.ts` and `bun run apps/worker/src/index.ts`
- `nixosModules.default` provides `services.mangy` with systemd units for migrate, server, and worker
- PostgreSQL is an external persistent dependency
- the worker must run anywhere the configured download destinations are reachable
- Komga can watch those destination folders directly
- set `KOMGA_BASE_URL` and either `KOMGA_API_KEY` or `KOMGA_USERNAME`/`KOMGA_PASSWORD` on the worker to request `POST /api/v1/libraries/:libraryId/scan` after downloads for destinations with a Komga library ID

The flake module deliberately owns no reverse proxy: the consuming host wires its own front (for example a Caddy vhost serving the web store path and proxying `/api/*` to the server port). Browser rendering for the WeebCentral adapter is development-only; the deployed worker uses the HTTP fallback path.

## Status

The project has moved well beyond the old calendar template, but some polish work is still ongoing:

- queue and tracking core flows are live
- notification preferences and SSE invalidation are live
- Slack delivery remains a separate follow-on from `slack-integration.md`
- broader hardening and cleanup continue in the remaining implementation work
