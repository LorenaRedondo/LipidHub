# Multi-stage build. Runs natively as linux/arm64 on Apple Silicon hosts (Docker
# Desktop / Colima) — no cross-arch emulation needed, so no --platform flags here.
# node:20-slim (Debian/glibc) is used instead of alpine (musl) so the native
# better-sqlite3 addon builds/runs against a well-supported libc.

FROM node:20-slim AS deps
WORKDIR /app
# better-sqlite3 has no prebuilt binary for linux/arm64 at this version, so it
# compiles from source via node-gyp — needs python3 + a C++ toolchain.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build \
 && npm run db:build

# ── api ──────────────────────────────────────────────────────────────────────
FROM node:20-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY mcp ./mcp
COPY src ./src
COPY --from=build /app/db/lipidhub.sqlite ./db/lipidhub.sqlite
EXPOSE 8787
CMD ["npx", "tsx", "server/api.ts"]

# ── web ──────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
