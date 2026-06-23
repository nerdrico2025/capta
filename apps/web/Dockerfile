FROM node:22-alpine AS builder
# cache-bust: 2026-06-04
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_API_URL é inlined no bundle em build-time (next build), então
# precisa estar presente ANTES do build. Configurável via build arg no Railway
# (Settings → Build → Build Args); default aponta para a API de produção.
ARG NEXT_PUBLIC_API_URL=https://captaapi-production.up.railway.app
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm ci
RUN npm run build --workspace=apps/web

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Cria symlink: /app/server.js → /app/apps/web/server.js
RUN ln -s /app/apps/web/server.js /app/server.js

USER nextjs
EXPOSE 3000

CMD ["node", "/app/apps/web/server.js"]
