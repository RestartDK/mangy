# Releases

Mangy publishes compiled server and worker binaries with every `v*` tag. The release workflow (`release.yml`) runs the checks, compiles four targets, and opens a GitHub Release with auto-generated notes:

- `bun-linux-x64`
- `bun-linux-arm64`
- `bun-darwin-x64`
- `bun-darwin-arm64`

## Creating a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

PRs merged since the previous tag become the release notes, so keep commit subjects descriptive.

## Running without Nix

You need Bun (for the web build and migrations) and PostgreSQL.

1. Download `mangy-server-<target>` and `mangy-worker-<target>` from the release.
2. Apply migrations with `bun run db:migrate` (requires `DATABASE_URL`, see `.env.example`).
3. Run the server and worker with the same environment: `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` are required; worker polling intervals and Komga scanning keys are optional. See `.env.example`.
4. Build the web app once: `bun install && cd apps/web && bun run build`.
5. Serve `apps/web/dist` with any static file server and proxy `/api/*` to the server (default port 3000, set `HOST` and `PORT` to change it).

The web build is origin-agnostic: without `VITE_SERVER_URL` it calls the origin the browser sees, so a single reverse proxy in front of both halves needs no extra configuration.

The compiled server and worker embed the Bun runtime and all JavaScript dependencies. Browser-based page extraction for the WeebCentral adapter is not available in release binaries; the HTTP fallback path is used instead.