# Build context must be the monorepo root:
#   docker build -f apps/api/Dockerfile -t capta-api .
# Or via docker-compose (context: . / dockerfile: apps/api/Dockerfile)

# ── Stage 1: install + build ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root manifests (workspace resolution + root tsconfig.json needed by app tsconfigs)
COPY package.json package-lock.json turbo.json tsconfig.json ./

# Copy workspace packages that api depends on
COPY packages/db/        ./packages/db/
COPY packages/shared/    ./packages/shared/

# Copy the app itself
COPY apps/api/           ./apps/api/

# Install all workspace deps from root (resolves local packages correctly)
RUN npm ci --workspace=@capta/db --workspace=@capta/shared --workspace=@capta/api \
    --include-workspace-root

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build TypeScript
RUN npm run build --workspace=@capta/api

# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled output and runtime dependencies
COPY --from=builder /app/apps/api/dist        ./dist
COPY --from=builder /app/node_modules         ./node_modules
COPY --from=builder /app/packages             ./packages

# Prisma schema needed for migrations at startup
COPY --from=builder /app/packages/db/prisma   ./packages/db/prisma

EXPOSE 3001
CMD ["node", "dist/index.js"]
