FROM oven/bun:1.3.4-slim AS base
WORKDIR /app

FROM base AS install
COPY bun.lock package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/downloader/package.json packages/downloader/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/push/package.json packages/push/package.json
COPY packages/source-sdk/package.json packages/source-sdk/package.json
RUN bun install --frozen-lockfile

FROM install AS source
COPY . .

FROM source AS web-build
ARG VITE_SERVER_URL=http://127.0.0.1:3000
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN cd apps/web && bun run build

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 3001

FROM source AS server
ENV NODE_ENV=production
RUN cd apps/server && bun run build
WORKDIR /app
EXPOSE 3000
CMD ["/app/apps/server/server"]

FROM source AS worker
ENV NODE_ENV=production
RUN cd apps/worker && bun run build
WORKDIR /app
CMD ["/app/apps/worker/worker"]
