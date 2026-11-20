# syntax=docker/dockerfile:1

# ---- deps: install dependencies only (cached unless lockfile changes) ----
FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: generate Prisma client and build the Next.js app ----
FROM node:24-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

# ---- runner: minimal image that only runs the standalone server ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Batch-record PDFs and the BPM report are rendered with Playwright's
# Chromium. The standalone build ships the `playwright` package but not a
# browser, so install one (plus its system libraries) at the exact version the
# app depends on, in a shared path the non-root user can read.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@1.63.0 install --with-deps chromium && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Local attachment storage (STORAGE_DRIVER=local); docker-compose mounts a
# volume here so files survive container rebuilds.
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
ENV STORAGE_LOCAL_DIR=/app/storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
# Escuchar en todas las interfaces (Docker inyecta HOSTNAME=<id del contenedor>,
# y sin esto el healthcheck contra localhost falla).
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
