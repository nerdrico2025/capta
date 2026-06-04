FROM node:22-alpine AS builder
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm ci
RUN npm run build --workspace=apps/web

# Debug: confirmar onde o server.js foi gerado
RUN find /app -name "server.js" -not -path "*/node_modules/*" 2>/dev/null

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia o standalone completo (mantém estrutura de monorepo)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Assets estáticos no lugar correto dentro do standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# Em monorepo Next.js standalone, o server.js fica em apps/web/server.js
CMD ["node", "apps/web/server.js"]
