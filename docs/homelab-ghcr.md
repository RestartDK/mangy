# Homelab GHCR Flow

This repo is responsible for building and publishing images.
Your homelab is responsible for running them.

## What lives in this repo

- `Dockerfile` for `web`, `server`, and `worker`
- `compose.example.yml` as a starting point for your homelab runtime stack
- `compose.env.example` as the matching env template
- `.github/workflows/ci.yml` for standard validation on pull requests and non-main pushes
- `.github/workflows/publish.yml` to publish private GHCR images on pushes to `main`
- application source code

## What should live outside this repo

Keep host-specific runtime state on `srv-hatchi`, not in the app repo.

The example compose files in this repo are templates only. Copy them into `/opt/homelab/mangy/` and treat the copied versions as the real runtime config.

Recommended home:

```text
/opt/homelab/mangy/
├── compose.yml
├── env/
│   └── mangy.env
├── data/
│   └── postgres/
└── scripts/
    └── update-mangy.sh
```

That host-side config is where you should keep:

- Podman Compose files
- GHCR login state
- private env vars and secrets
- update / restart scripts
- any future UI or helper service that lets you accept updates manually

## Intended release flow

1. Merge to `main`
2. GitHub Actions publishes new private images to GHCR
3. `srv-hatchi` notices or is told that a newer image exists
4. You approve the update from your homelab side
5. `srv-hatchi` pulls the image and restarts the stack

## Why this split is cleaner

- the app repo stays portable
- your host paths and secrets do not live in app source control
- `/opt/homelab` remains the source of truth for runtime config
- you can change hosts later without redesigning the app repo

## Private GHCR image names

The workflow publishes:

- `ghcr.io/<owner>/mangy-web:main`
- `ghcr.io/<owner>/mangy-server:main`
- `ghcr.io/<owner>/mangy-worker:main`
- matching immutable `sha-<commit>` tags

## What to do on `srv-hatchi`

- copy `compose.example.yml` to `/opt/homelab/mangy/compose.yml`
- copy `compose.env.example` to `/opt/homelab/mangy/env/mangy.env`
- log Podman into `ghcr.io` with a token that can read private packages
- use the GHCR image tags in your compose file
- build your manual-accept update flow there, not in this repo
