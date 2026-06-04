FROM node:22-alpine AS builder
# cache-bust: 2026-06-03
WORKDIR /app

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci
RUN cd packages/db && npx prisma generate
RUN npm run build --workspace=apps/api
RUN echo "=== ARQUIVOS GERADOS ===" && find apps/api/dist -type f | head -20

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 3001

RUN find /app -name "*.js" -maxdepth 4 | head -30 || true

CMD ["node", "dist/index.js"]
