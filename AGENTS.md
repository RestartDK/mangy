# Agent Guidelines

## Build & Dev Commands

- **Package manager**: `bun` (v1.3.4)
- **Dev**: `bun dev` (all), `bun dev:web`, `bun dev:server`
- **Build**: `bun build`
- **Type check**: `bun check-types`
- **Lint/Format**: `bun check` (format and report), `bun lint` (check only), `bun lint:fix` (apply Oxlint fixes)
- **Database**: `bun db:start`, `bun db:migrate`, `bun db:generate`, `bun db:studio`

## Code Style (Ultracite/Oxc)

- Use `const` by default, `let` when needed, never `var`
- Arrow functions for callbacks; `for...of` over `.forEach()`
- Explicit types for function params/returns; prefer `unknown` over `any`
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Template literals over string concatenation; use destructuring
- React: function components, hooks at top level, proper `key` props
- Async: always `await` promises, use try-catch, no floating promises
- No `console.log`/`debugger` in production; throw `Error` objects, not strings
- Early returns over nested conditionals; keep functions focused
- Security: `rel="noopener"` with `target="_blank"`, avoid `dangerouslySetInnerHTML`

## Project Structure

Monorepo with Turborepo: `apps/` (web, server) and `packages/` (auth, db, config).
TypeScript strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`.

### Server Architecture (Feature-Based Modules)

The server follows a feature-based module structure:

```
apps/server/src/
  index.ts              # Entrypoint - composes modules
  lib/
    auth.ts             # Shared utilities (getSessionUser)
  modules/
    downloads/          # One directory per domain
      index.ts          # effect/http-api handlers for that group
      service.ts        # Business logic (Effect programs over effect/sql)
      storage.ts        # Row-level SQL, when the module needs it
    library/
    live/
    notifications/
    series/
    settings/
    sources/
    tracking/
```

**Key principles:**

- **Use path aliases**: Always use `@/*` imports instead of relative paths (`../`)
- **Separation of concerns**: `index.ts` maps HTTP to service calls, `service.ts` holds the logic
- **Shared utilities**: Common code (like auth) goes in `lib/`
- **Module composition**: `index.ts` composes the API with `HttpApiBuilder.group(Api, ...)`
- **No framework glue in services**: services return Effects and never see a Request

## UI Components

**NEVER** edit files in `apps/web/src/components/ui/` unless specifically requested. These are atomic shadcn components and should remain untouched. Apply styling overrides via `className` props when using these components.

## Type Management

One source of truth, and it is the Effect Schema. Types flow from the table models in
`@mangy/db` to the `HttpApi` definition in `@mangy/contract`, and both apps derive from
that contract rather than declaring anything of their own.

```
packages/db/src/model/*        # Model.Class per table: columns, ids, brands
packages/contract/src/*        # HttpApi groups: params, payload, success, typed errors
apps/server                    # HttpApiBuilder.group(Api, ...) implements the contract
apps/web                       # AtomHttpApi.Service over the same Api value
```

- **NEVER** write a second TypeScript interface for an API request or response. Derive it
  from the contract with `typeof schema.Type`, or let the client infer it.
- Absence is `Option`, not `null` and not a missing key. Response fields use
  `Schema.OptionFromNullOr`, so `None` is `null` on the wire and `Some("")` is a present
  empty string. Read them with `Option.isSome`, `Option.getOrElse` or `Option.match`, and
  never test an `Option` for truthiness, since an Option object is always truthy.
- A parsed value stays parsed. Do not add a helper that converts an `Option` back to
  `undefined`, and do not narrow `unknown` with a hand-written predicate that claims a
  shape it never checked. Decode with a schema at the boundary instead.
- Request payloads are validated by the contract, and the web reads responses through
  `AtomHttpApi` in `apps/web/src/atoms/*`, where an atom's value is an `AsyncResult` and
  `AsyncResult.value` yields an `Option`.

## Environment Variables

Type-safe env is handled by `@mangy/env` with two exports:

- **`@mangy/env`** → Server-side (uses `process.env`)
- **`@mangy/env/client`** → Client-side for Vite (uses `import.meta.env`)

```typescript
// Server (packages/auth, packages/db, apps/server)
import { env } from "@mangy/env";
env.DATABASE_URL  // required - throws if missing
env.PORT          // optional - defaults to "3000"

// Client (apps/web)
import { env } from "@mangy/env/client";
env.VITE_SERVER_URL  // required - throws if missing
```

**Never** use raw `process.env` or `import.meta.env` directly. Always use the typed `env` object.

### Turborepo Configuration

**ALWAYS** add new environment variables to `turbo.json` when adding them to the codebase. Environment variables used at runtime must be declared in the relevant task's `env` array (e.g., `server#start`, `web#build`) so Turborepo knows they're required dependencies. This ensures proper caching and deployment configuration.

## Deployment

Packaging is Nix: `flake.nix` provides `mangy-web`, `mangy-app`, a dev shell, and the `services.mangy` NixOS module. The module owns systemd units and no reverse proxy; hosts wire their own front.

## Cursor Cloud specific instructions

### Prerequisites

Bun v1.3.4 or newer must be available. PostgreSQL comes from the Nix dev shell (`nix develop`) or any local install; the database scripts need `initdb`/`pg_ctl` on PATH.

### Starting the stack

1. **Database**: `bun db:start` — starts PostgreSQL on port 5432 from the `.mangy-postgres` data dir.
2. **Migrations**: `bun db:migrate` — auto-runs as a turbo dependency of `server#dev`, but can be run manually.
3. **Dev servers**: `bun dev` starts web (port 3001), server (port 3000), and worker together. Use `bun dev:web` / `bun dev:server` / `bun dev:worker` individually.

### Environment

Copy `.env.example` to `.env` at the repo root if it doesn't exist. The only value that must be changed from the example is `BETTER_AUTH_SECRET` (set any 32+ char string). All other defaults work for local development. VAPID keys are optional (push notifications only).

### Lint & tests

- `bun lint` — Oxfmt format check plus Oxlint (the Ultracite preset reports about 850 pre-existing violations; clearing them is separate work).
- `bun lint:fix` — applies Oxlint's fixes. Some of them are unsafe on this codebase: `unicorn/no-useless-undefined` deletes required call arguments and `unicorn/prefer-spread` spreads array-likes. Run `bun check-types` after it.
- `bun check-types` — TypeScript strict-mode type check across all packages.
- `bun test:integration` — runs the server integration test suite; requires PostgreSQL running and migrated.

### Gotchas

- `bun db:start` initializes `.mangy-postgres` on first run and starts PostgreSQL with trust auth on localhost; `bun db:stop` stops it.
- Turbo `dev` task runs migrations automatically before starting `server` and `worker` (defined in `turbo.json` via `dependsOn`).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
