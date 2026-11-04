# syntax=docker/dockerfile:1.7
# Nopa backend: multi-stage build.
#   builder  - full install (dev deps for tsc + prisma CLI), prisma generate, tsc
#   migrator - the builder image with `prisma migrate deploy` as its command (one-shot job)
#   prod-deps- builder's node_modules pruned to production dependencies
#   runner   - the image that runs: dist + prod node_modules + public, non-root, no source, no uploads
#
# User files (uploads/, chat-files/) are never baked into the image: mount them as volumes.
# PDF export (html-pdf-node) needs Chrome at /usr/bin/google-chrome-stable (see patches/); it is not
# installed here, so those endpoints only work on the PM2 host.

ARG NODE_IMAGE=node:20.18.1-alpine3.20

# ---------- builder ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
# Prisma's query engine needs OpenSSL on Alpine (musl)
RUN apk add --no-cache openssl
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Dependency layer: changes only when package files, patches or the schema change
COPY package.json package-lock.json .npmrc ./
COPY patches ./patches
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- migrator (one-shot: `prisma migrate deploy`) ----------
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- prod-deps ----------
FROM builder AS prod-deps
# Keeps the generated client in node_modules/.prisma and the patch-package edits; drops tsc, prisma CLI, etc.
RUN npm prune --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- runner ----------
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    CHAT_FILES_DIR=/data/chat-files

COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY public ./public

# Writable mount points owned by the unprivileged user
RUN mkdir -p /app/uploads /data/chat-files && chown -R node:node /app/uploads /data
USER node

EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/health >/dev/null || exit 1

# Migrations are NOT run here: run the `migrator` target (or `npm run db:migrate` on the PM2 host) first.
CMD ["node", "dist/server.js"]
