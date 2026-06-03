# Build context must be the monorepo root:
#   docker build -f apps/web/Dockerfile -t capta-web .
# Or via docker-compose (context: . / dockerfile: apps/web/Dockerfile)

# ── Stage 1: install + build ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root manifests (workspace resolution + root tsconfig.json needed by app tsconfigs)
COPY package.json package-lock.json turbo.json tsconfig.json ./

# Copy workspace packages that web depends on
COPY packages/shared/    ./packages/shared/

# Copy the app itself
COPY apps/web/           ./apps/web/

# Install all workspace deps from root
RUN npm ci --workspace=@capta/shared --workspace=@capta/web \
    --include-workspace-root

ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js (output: 'standalone' in next.config.mjs)
RUN npm run build --workspace=@capta/web

# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output bundles everything needed; copy public assets too
COPY --from=builder /app/apps/web/public                          ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
