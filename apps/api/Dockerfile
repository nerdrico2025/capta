FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache \
  openssl \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci

RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Mostra erros de TypeScript explicitamente (sem falhar silencioso)
RUN npm run build --workspace=apps/api 2>&1 || (echo "=== BUILD FAILED ===" && exit 1)

# Confirma que o dist foi gerado
RUN ls -la apps/api/dist/ && echo "=== dist OK ==="

RUN npm prune --production

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
