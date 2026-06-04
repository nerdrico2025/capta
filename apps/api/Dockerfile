FROM node:22-alpine
WORKDIR /app

# Dependências do sistema para pacotes nativos (openssl para Prisma)
RUN apk add --no-cache openssl

# Não baixar o Chromium do Puppeteer em produção
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copia tudo necessário para o monorepo
COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Instala todas as dependências (dev incluída, necessária para o build)
RUN npm ci

# Gera o Prisma client com o caminho explícito do schema
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Compila o TypeScript
RUN npm run build --workspace=apps/api

# Remove devDependencies para imagem mais leve
RUN npm prune --production

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
