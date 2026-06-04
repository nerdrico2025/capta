FROM node:22-alpine
WORKDIR /app

# Instala dependências do sistema necessárias para alguns pacotes nativos
RUN apk add --no-cache openssl

# Copia tudo necessário para o monorepo funcionar
COPY package*.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Instala TODAS as dependências (incluindo dev para o build)
RUN npm ci

# Gera o Prisma client
RUN cd packages/db && npx prisma generate

# Compila o TypeScript
RUN npm run build --workspace=apps/api

# Remove devDependencies para reduzir tamanho
RUN npm prune --production

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
