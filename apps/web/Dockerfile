FROM node:22-alpine AS builder
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm ci
RUN npm run build --workspace=apps/web

# Debug: mostrar onde o server.js foi gerado
RUN find /app/apps/web/.next/standalone -name "server.js" 2>/dev/null || echo "server.js NOT FOUND"
RUN ls -la /app/apps/web/.next/standalone/ 2>/dev/null || echo "standalone dir NOT FOUND"

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia o standalone inteiro mantendo a estrutura
COPY --from=builder /app/apps/web/.next/standalone ./
# Copia os assets estáticos para o lugar certo
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Em monorepo, o server.js fica em apps/web/server.js dentro do standalone
CMD ["node", "apps/web/server.js"]
