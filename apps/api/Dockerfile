FROM node:22-alpine AS builder
# cache-bust: 2026-06-03
WORKDIR /app

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci
RUN cd packages/db && npx prisma generate
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia node_modules completo da raiz (onde ficam os pacotes do workspace)
COPY --from=builder /app/node_modules ./node_modules

# Copia node_modules local da api se existir (pacotes específicos do workspace)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copia packages compartilhados
COPY --from=builder /app/packages ./packages

# Copia o build compilado
COPY --from=builder /app/apps/api/dist ./dist

# Copia package.json para o Node resolver os módulos
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/package.json ./root-package.json

EXPOSE 3001
CMD ["node", "dist/index.js"]
